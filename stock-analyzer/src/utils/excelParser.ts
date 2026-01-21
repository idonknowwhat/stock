import * as XLSX from 'xlsx';
import type { Stock, StockGroup, DayData } from '../types';

// 从文件名提取日期
export function extractDateFromFilename(filename: string): string {
  const match = filename.match(/(\d{8})/);
  if (match) {
    const dateStr = match[1];
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return new Date().toISOString().split('T')[0];
}

// 判断是否为分组标记行
function isGroupMarker(code: string): boolean {
  if (!code) return true;
  // 分组标记通常是中文，不是数字开头
  return !/^\d/.test(code.toString().trim());
}

// 判断是否为指数
function isIndex(code: string): boolean {
  return code?.toString().startsWith('99');
}

// 解析Excel文件
export async function parseExcelFile(file: File): Promise<DayData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        let jsonData: Record<string, unknown>[] = [];
        
        // 先尝试用GBK解码看是否为文本格式
        let text = '';
        try {
          const decoder = new TextDecoder('gbk');
          text = decoder.decode(data);
        } catch {
          // 如果GBK失败，尝试UTF-8
          const decoder = new TextDecoder('utf-8');
          text = decoder.decode(data);
        }
        
        // 检查是否为制表符分隔的文本 (通达信常见格式)
        if (text.includes('\t') && (text.includes('代码') || text.includes('名称'))) {
          console.log('检测到制表符分隔格式');
          jsonData = parseTextData(text);
        } else {
          // 尝试作为Excel读取
          try {
            const workbook = XLSX.read(data, { type: 'array', codepage: 936 });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
              raw: false,
              defval: '',
            });
          } catch (xlsError) {
            console.log('Excel解析失败，尝试文本解析', xlsError);
            jsonData = parseTextData(text);
          }
        }
        
        console.log('解析到的数据行数:', jsonData.length);
        if (jsonData.length > 0) {
          console.log('第一行数据:', jsonData[0]);
        }
        
        // 判断是K线数据还是自选股列表
        const isKLineData = detectKLineFormat(text);
        
        let result: DayData;
        if (isKLineData) {
          console.log('检测到K线历史数据格式');
          result = parseKLineData(text, file.name);
        } else {
          result = parseStockData(jsonData, file.name);
        }
        
        console.log('解析结果:', result.allStocks.length, '只股票');
        resolve(result);
      } catch (error) {
        console.error('解析错误:', error);
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 检测是否为K线历史数据格式
function detectKLineFormat(text: string): boolean {
  // K线数据特征：
  // 1. 第一行包含股票名称和代码（如 "中富科技 (003018)"）
  // 2. 表头包含 "时间"、"开盘"、"最高"、"最低"、"收盘" 等
  // 3. 数据行包含日期格式（如 2024/03/20）
  
  const hasKLineHeaders = text.includes('开盘') || text.includes('最高') || text.includes('最低') || text.includes('收盘');
  const hasDateData = /\d{4}\/\d{2}\/\d{2}/.test(text);
  const hasStockNameInFirstLine = /\(\d{6}\)/.test(text.split('\n')[0] || '');
  
  // 如果没有"代码"和"名称"列，但有K线特征，则是K线数据
  const hasStockListHeaders = text.includes('代码') && text.includes('名称') && text.includes('涨幅');
  
  return !hasStockListHeaders && hasKLineHeaders && hasDateData && hasStockNameInFirstLine;
}

// 解析K线历史数据，提取股票信息和最新数据
function parseKLineData(text: string, filename: string): DayData {
  const lines = text.split('\n').filter(line => line.trim());
  
  // 从第一行提取股票名称和代码
  const firstLine = lines[0] || '';
  const codeMatch = firstLine.match(/\((\d{6})\)/);
  const code = codeMatch ? codeMatch[1] : filename.replace(/\.xls.*/i, '');
  
  // 提取名称（代码前面的部分）
  let name = firstLine.replace(/\s*\(\d{6}\)\s*/, '').trim();
  if (!name || name.includes('�')) {
    // 如果名称有乱码，用代码代替
    name = `股票${code}`;
  }
  
  // 找到数据行（以日期开头的行）
  const dataLines = lines.filter(line => /^\s*\d{4}\/\d{2}\/\d{2}/.test(line));
  
  if (dataLines.length === 0) {
    return {
      date: extractDateFromFilename(filename),
      groups: [],
      allStocks: [],
    };
  }
  
  // 获取最新一天的数据（最后一行）
  const latestLine = dataLines[dataLines.length - 1];
  const values = latestLine.split('\t').map(v => v.trim());
  
  // 解析数据：时间 开盘 最高 最低 收盘 成交量 ...
  const dateStr = values[0] || '';
  const open = parseFloat(values[1]) || 0;
  const high = parseFloat(values[2]) || 0;
  const low = parseFloat(values[3]) || 0;
  const close = parseFloat(values[4]) || 0;
  const volume = parseFloat(values[5]) || 0;
  
  // 计算涨跌幅（需要前一天数据）
  let change = 0;
  if (dataLines.length >= 2) {
    const prevLine = dataLines[dataLines.length - 2];
    const prevValues = prevLine.split('\t').map(v => v.trim());
    const prevClose = parseFloat(prevValues[4]) || close;
    if (prevClose > 0) {
      change = ((close - prevClose) / prevClose) * 100;
    }
  }
  
  // 计算振幅
  const amplitude = close > 0 ? ((high - low) / close) * 100 : 0;
  
  // 创建股票对象
  const stock: Stock = {
    code,
    name,
    price: close,
    change: Math.round(change * 100) / 100,
    volume,
    turnover: 0, // K线数据中没有换手率
    amplitude: Math.round(amplitude * 100) / 100,
    pe: 0,
    marketCap: 0,
    industry: '',
    region: '',
    high,
    low,
    open,
  };
  
  // 从日期字符串提取日期
  const dateMatch = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : extractDateFromFilename(filename);
  
  return {
    date,
    groups: [{ name: 'K线导入', stocks: [stock] }],
    allStocks: [stock],
  };
}

// 解析纯文本/制表符分隔的数据
function parseTextData(text: string): Record<string, unknown>[] {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];
  
  // 找到表头行
  let headerIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('代码') && lines[i].includes('名称')) {
      headerIndex = i;
      break;
    }
  }
  
  const headers = lines[headerIndex].split('\t').map(h => h.trim());
  const result: Record<string, unknown>[] = [];
  
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    if (Object.keys(row).length > 0) {
      result.push(row);
    }
  }
  
  return result;
}

// 解析股票数据
function parseStockData(rows: Record<string, any>[], filename: string): DayData {
  const groups: StockGroup[] = [];
  let currentGroup: StockGroup = { name: '未分类', stocks: [] };
  let indexStock: Stock | undefined;
  
  for (const row of rows) {
    const code = cleanCode(row['代码'] || row['code'] || '');
    const name = (row['名称'] || row['name'] || '').toString().trim();
    
    // 跳过空行和注释行
    if (!code && !name) continue;
    if (code.includes('数据来源') || name.includes('数据来源')) continue;
    if (code.includes('重复') || name.includes('重复')) continue;
    
    // 分组标记行
    if (isGroupMarker(code)) {
      const groupName = code || name;
      if (groupName && currentGroup.stocks.length > 0) {
        groups.push(currentGroup);
      }
      if (groupName) {
        currentGroup = { name: groupName, stocks: [] };
      }
      continue;
    }
    
    // 解析股票数据
    const stock = parseStockRow(row, code, name);
    
    // 分离指数
    if (isIndex(code)) {
      indexStock = stock;
    } else {
      currentGroup.stocks.push(stock);
    }
  }
  
  // 添加最后一个分组
  if (currentGroup.stocks.length > 0) {
    groups.push(currentGroup);
  }
  
  // 收集所有股票（去重）
  const allStocksMap = new Map<string, Stock>();
  for (const group of groups) {
    for (const stock of group.stocks) {
      if (!allStocksMap.has(stock.code)) {
        allStocksMap.set(stock.code, stock);
      }
    }
  }
  
  return {
    date: extractDateFromFilename(filename),
    index: indexStock,
    groups,
    allStocks: Array.from(allStocksMap.values()),
  };
}

// 清理代码字段
function cleanCode(code: string): string {
  return code.toString().replace(/[="']/g, '').trim();
}

// 解析单行股票数据
function parseStockRow(row: Record<string, any>, code: string, name: string): Stock {
  const parseNum = (val: any): number => {
    if (val === undefined || val === null || val === '' || val === '--') return 0;
    // 移除逗号、亿、万等单位
    const num = parseFloat(val.toString().replace(/[,亿万㈢]/g, ''));
    return isNaN(num) ? 0 : num;
  };
  
  // 解析流通市值（可能带"亿"字）
  const parseMarketCap = (val: any): number => {
    if (!val) return 0;
    const str = val.toString();
    if (str.includes('亿')) {
      return parseFloat(str.replace(/[^0-9.-]/g, '')) || 0;
    }
    return parseNum(val) / 10000; // 万转亿
  };
  
  return {
    code,
    name,
    // 基础数据
    change: parseNum(row['涨幅%']),
    price: parseNum(row['现价']),
    volume: parseNum(row['总量'] || row['成交量']),
    turnover: parseNum(row['换手%']),
    pe: parseNum(row['市盈(动)']),
    marketCap: parseMarketCap(row['流通市值'] || row['总金额']),
    industry: (row['细分行业'] || '').toString().trim(),
    region: (row['地区'] || '').toString().trim(),
    amplitude: parseNum(row['振幅%']),
    high: parseNum(row['最高']),
    low: parseNum(row['最低']),
    open: parseNum(row['今开'] || row['开盘']),
    
    // 多日涨幅趋势
    change3d: parseNum(row['3日涨幅%']),
    change5d: parseNum(row['5日涨幅%']),
    change10d: parseNum(row['10日涨幅%']),
    change20d: parseNum(row['20日涨幅%']),
    change60d: parseNum(row['60日涨幅%']),
    changeYear: parseNum(row['一年涨幅%']),
    
    // 技术指标
    volumeRatio: parseNum(row['量比']),
    upDays: parseNum(row['连涨天']),
    technicalSignal: (row['近日指标提示'] || '').toString().trim(),
    dist5ma: parseNum(row['距5日线%']),
    
    // 估值指标
    peTTM: parseNum(row['市盈(TTM)']),
    pb: parseNum(row['市净率']),
    ps: parseNum(row['市销率']),
    
    // 财务指标
    grossMargin: parseNum(row['毛利率%']),
    netMargin: parseNum(row['净利率%']),
    debtRatio: parseNum(row['资产负债率%']),
    profitYoy: parseNum(row['利润同比%']),
    revenueYoy: parseNum(row['收入同比%']),
    dividendYield: parseNum(row['股息率%']),
  };
}

// 计算分析结果
export function analyzeStocks(stocks: Stock[]): {
  upCount: number;
  downCount: number;
  avgChange: number;
  maxChange: number;
  minChange: number;
} {
  if (stocks.length === 0) {
    return { upCount: 0, downCount: 0, avgChange: 0, maxChange: 0, minChange: 0 };
  }
  
  const changes = stocks.map(s => s.change);
  return {
    upCount: changes.filter(c => c > 0).length,
    downCount: changes.filter(c => c < 0).length,
    avgChange: changes.reduce((a, b) => a + b, 0) / changes.length,
    maxChange: Math.max(...changes),
    minChange: Math.min(...changes),
  };
}

// 获取行业分布
export function getIndustryDistribution(stocks: Stock[]): { name: string; count: number; avgChange: number }[] {
  const map = new Map<string, { count: number; totalChange: number }>();
  
  for (const stock of stocks) {
    const industry = stock.industry || '未知';
    const existing = map.get(industry) || { count: 0, totalChange: 0 };
    map.set(industry, {
      count: existing.count + 1,
      totalChange: existing.totalChange + stock.change,
    });
  }
  
  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      avgChange: data.totalChange / data.count,
    }))
    .sort((a, b) => b.count - a.count);
}

// 查找多日重复出现的股票
export function findRepeatedStocks(dayDataList: DayData[]): Map<string, {
  stock: Stock;
  dates: string[];
  formulas: Set<string>;
  changes: number[];
}> {
  const stockMap = new Map<string, {
    stock: Stock;
    dates: string[];
    formulas: Set<string>;
    changes: number[];
  }>();
  
  for (const dayData of dayDataList) {
    for (const group of dayData.groups) {
      for (const stock of group.stocks) {
        const existing = stockMap.get(stock.code);
        if (existing) {
          if (!existing.dates.includes(dayData.date)) {
            existing.dates.push(dayData.date);
            existing.changes.push(stock.change);
          }
          existing.formulas.add(group.name);
          existing.stock = stock; // 更新为最新数据
        } else {
          stockMap.set(stock.code, {
            stock,
            dates: [dayData.date],
            formulas: new Set([group.name]),
            changes: [stock.change],
          });
        }
      }
    }
  }
  
  return stockMap;
}

// 查找单日内被多个公式选中的股票
export function findMultiFormulaStocks(dayData: DayData): Map<string, string[]> {
  const stockFormulas = new Map<string, string[]>();
  
  for (const group of dayData.groups) {
    for (const stock of group.stocks) {
      const formulas = stockFormulas.get(stock.code) || [];
      if (!formulas.includes(group.name)) {
        formulas.push(group.name);
      }
      stockFormulas.set(stock.code, formulas);
    }
  }
  
  // 只返回被多个公式选中的
  const result = new Map<string, string[]>();
  for (const [code, formulas] of stockFormulas) {
    if (formulas.length > 1) {
      result.set(code, formulas);
    }
  }
  
  return result;
}

// 股票评分和排行
export interface StockRanking {
  stock: Stock;
  score: number;
  rank: number;
  formulaCount: number;
  formulas: string[];
  scoreDetails: {
    changeScore: number;      // 涨幅得分
    formulaScore: number;     // 公式信号得分
    turnoverScore: number;    // 换手率得分
    amplitudeScore: number;   // 振幅得分
    trendScore: number;       // 趋势得分
  };
  recommendation: 'strong' | 'medium' | 'weak';
}

export function calculateStockRankings(dayData: DayData): StockRanking[] {
  // 收集每只股票被哪些公式选中
  const stockFormulaMap = new Map<string, string[]>();
  for (const group of dayData.groups) {
    for (const stock of group.stocks) {
      const formulas = stockFormulaMap.get(stock.code) || [];
      if (!formulas.includes(group.name)) {
        formulas.push(group.name);
      }
      stockFormulaMap.set(stock.code, formulas);
    }
  }
  
  // 计算每只股票的得分
  const rankings: StockRanking[] = dayData.allStocks.map(stock => {
    const formulas = stockFormulaMap.get(stock.code) || [];
    const formulaCount = formulas.length;
    
    // ========== 涨幅得分 (0-30分) ==========
    // 使用连续函数，涨幅在0-5%区间得分线性增长，超过5%略微递减（追高风险）
    let changeScore = 0;
    if (stock.change >= 9.5) {
      changeScore = 28; // 涨停，高分但略有追高风险
    } else if (stock.change >= 5) {
      changeScore = 26 + (stock.change - 5) * 0.4; // 5-9.5% 区间
    } else if (stock.change >= 3) {
      changeScore = 20 + (stock.change - 3) * 3; // 3-5% 区间，每1%加3分
    } else if (stock.change >= 1) {
      changeScore = 14 + (stock.change - 1) * 3; // 1-3% 区间
    } else if (stock.change >= 0) {
      changeScore = 10 + stock.change * 4; // 0-1% 区间
    } else if (stock.change >= -2) {
      changeScore = 6 + (stock.change + 2) * 2; // -2~0% 区间
    } else if (stock.change >= -5) {
      changeScore = 2 + (stock.change + 5) * 1.33; // -5~-2% 区间
    } else {
      changeScore = Math.max(0, 2 + (stock.change + 5) * 0.2); // <-5%
    }
    changeScore = Math.round(changeScore * 10) / 10; // 保留1位小数
    
    // ========== 公式信号得分 (0-40分) ==========
    // 被1个公式选中：18分，2个：32分，3个：38分，4个+：40分
    let formulaScore = 0;
    if (formulaCount === 1) formulaScore = 18;
    else if (formulaCount === 2) formulaScore = 32;
    else if (formulaCount === 3) formulaScore = 38;
    else if (formulaCount >= 4) formulaScore = 40;
    
    // ========== 换手率得分 (0-15分) ==========
    // 最佳换手率3-8%，使用钟形曲线
    let turnoverScore = 0;
    const optimalTurnover = 5; // 最佳换手率
    if (stock.turnover > 0) {
      const turnoverDiff = Math.abs(stock.turnover - optimalTurnover);
      if (turnoverDiff <= 2) {
        turnoverScore = 15 - turnoverDiff * 1.5; // 3-7%区间，满分附近
      } else if (turnoverDiff <= 4) {
        turnoverScore = 12 - (turnoverDiff - 2) * 2; // 1-3% 或 7-9%
      } else if (turnoverDiff <= 8) {
        turnoverScore = 8 - (turnoverDiff - 4) * 1.5; // 更远区间
      } else {
        turnoverScore = Math.max(1, 2 - (turnoverDiff - 8) * 0.2);
      }
    }
    turnoverScore = Math.round(turnoverScore * 10) / 10;
    
    // ========== 振幅得分 (0-15分) ==========
    // 最佳振幅2-5%，太小说明无活跃度，太大说明波动风险
    let amplitudeScore = 0;
    const optimalAmplitude = 3.5;
    if (stock.amplitude > 0) {
      const ampDiff = Math.abs(stock.amplitude - optimalAmplitude);
      if (ampDiff <= 1.5) {
        amplitudeScore = 15 - ampDiff * 2;
      } else if (ampDiff <= 3) {
        amplitudeScore = 12 - (ampDiff - 1.5) * 2.5;
      } else if (ampDiff <= 6) {
        amplitudeScore = 8.25 - (ampDiff - 3) * 1.5;
      } else {
        amplitudeScore = Math.max(1, 3.75 - (ampDiff - 6) * 0.3);
      }
    }
    amplitudeScore = Math.round(amplitudeScore * 10) / 10;
    
    // ========== 趋势得分 (0-20分) - 新增！==========
    // 根据多日涨幅判断趋势强度
    let trendScore = 0;
    const c5 = stock.change5d || 0;
    const c10 = stock.change10d || 0;
    const c20 = stock.change20d || 0;
    
    // 短期趋势 (5日) - 最多8分
    if (c5 > 10) trendScore += 8;
    else if (c5 > 5) trendScore += 6 + (c5 - 5) * 0.4;
    else if (c5 > 0) trendScore += 3 + c5 * 0.6;
    else if (c5 > -5) trendScore += Math.max(0, 3 + c5 * 0.5);
    else trendScore += 0;
    
    // 中期趋势 (10日) - 最多6分
    if (c10 > 15) trendScore += 6;
    else if (c10 > 5) trendScore += 3 + (c10 - 5) * 0.3;
    else if (c10 > 0) trendScore += 1.5 + c10 * 0.3;
    else trendScore += Math.max(0, 1.5 + c10 * 0.15);
    
    // 长期趋势 (20日) - 最多6分
    if (c20 > 20) trendScore += 6;
    else if (c20 > 10) trendScore += 4 + (c20 - 10) * 0.2;
    else if (c20 > 0) trendScore += 2 + c20 * 0.2;
    else trendScore += Math.max(0, 2 + c20 * 0.1);
    
    trendScore = Math.round(trendScore * 10) / 10;
    
    // 总分 (满分100分 = 30+40+15+15 -> 现在是 25+35+10+10+20)
    // 重新分配权重以容纳趋势分
    const adjustedChangeScore = changeScore * 0.83; // 30->25
    const adjustedFormulaScore = formulaScore * 0.875; // 40->35
    const adjustedTurnoverScore = turnoverScore * 0.67; // 15->10
    const adjustedAmplitudeScore = amplitudeScore * 0.67; // 15->10
    
    const totalScore = Math.round((adjustedChangeScore + adjustedFormulaScore + adjustedTurnoverScore + adjustedAmplitudeScore + trendScore) * 10) / 10;
    
    // 推荐等级 - 更严格的标准
    let recommendation: 'strong' | 'medium' | 'weak' = 'weak';
    if (totalScore >= 70 && formulaCount >= 2 && trendScore >= 10) recommendation = 'strong';
    else if (totalScore >= 55 || (totalScore >= 45 && formulaCount >= 2)) recommendation = 'medium';
    
    return {
      stock,
      score: totalScore,
      rank: 0, // 稍后设置
      formulaCount,
      formulas,
      scoreDetails: {
        changeScore: Math.round(adjustedChangeScore * 10) / 10,
        formulaScore: Math.round(adjustedFormulaScore * 10) / 10,
        turnoverScore: Math.round(adjustedTurnoverScore * 10) / 10,
        amplitudeScore: Math.round(adjustedAmplitudeScore * 10) / 10,
        trendScore,
      },
      recommendation,
    };
  });
  
  // 按得分排序
  rankings.sort((a, b) => b.score - a.score);
  
  // 设置排名
  rankings.forEach((r, index) => {
    r.rank = index + 1;
  });
  
  return rankings;
}
