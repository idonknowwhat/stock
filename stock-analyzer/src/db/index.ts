/**
 * 股票分析器数据库
 * 使用 IndexedDB (通过 Dexie.js) 存储股票数据
 */

import Dexie, { type EntityTable } from 'dexie';

// ==================== 数据库表类型定义 ====================

/**
 * 股票基础信息表
 * 存储股票的静态信息，按 code 去重
 */
export interface StockInfo {
  code: string;           // 主键：股票代码
  name: string;           // 股票名称
  industry: string;       // 细分行业
  region: string;         // 地区
  updatedAt: string;      // 最后更新时间
}

/**
 * 每日数据记录表
 * 存储股票每天的动态数据
 */
export interface DailyRecord {
  id: string;             // 主键：code_date 组合
  code: string;           // 股票代码（索引）
  date: string;           // 日期（索引）

  // 价格数据
  price: number;          // 现价
  open: number;           // 开盘价
  high: number;           // 最高价
  low: number;            // 最低价
  change: number;         // 涨跌幅%

  // 交易数据
  volume: number;         // 成交量
  turnover: number;       // 换手率%
  amplitude: number;      // 振幅%

  // 估值数据
  pe: number;             // 市盈率(动)
  peTTM?: number;         // 市盈率TTM
  pb?: number;            // 市净率
  ps?: number;            // 市销率
  marketCap: number;      // 流通市值(亿)

  // 趋势数据
  change3d?: number;      // 3日涨幅%
  change5d?: number;      // 5日涨幅%
  change10d?: number;     // 10日涨幅%
  change20d?: number;     // 20日涨幅%
  change60d?: number;     // 60日涨幅%
  changeYear?: number;    // 一年涨幅%

  // 技术指标
  volumeRatio?: number;   // 量比
  upDays?: number;        // 连涨天
  technicalSignal?: string; // 近日指标提示
  dist5ma?: number;       // 距5日线%

  // 财务指标
  grossMargin?: number;   // 毛利率%
  netMargin?: number;     // 净利率%
  debtRatio?: number;     // 资产负债率%
  profitYoy?: number;     // 利润同比%
  revenueYoy?: number;    // 收入同比%
  dividendYield?: number; // 股息率%

  // 选股公式
  formulas: string[];     // 当天被哪些公式选中

  // 元数据
  createdAt: string;      // 记录创建时间
}

/**
 * 日期元数据表
 * 存储每个导入日期的汇总信息
 */
export interface DateMeta {
  date: string;           // 主键：日期
  stockCount: number;     // 当天股票数量
  formulaCount: number;   // 当天公式数量
  formulas: string[];     // 公式名称列表
  indexCode?: string;     // 大盘指数代码
  indexName?: string;     // 大盘指数名称
  indexPrice?: number;    // 大盘指数价格
  indexChange?: number;   // 大盘指数涨跌幅
  importedAt: string;     // 导入时间
}

/**
 * AI 分析摘要表
 * 存储每日/每周的 AI 分析汇总结果
 */
export interface AIAnalysisSummary {
  id: string;             // 主键：date_type 组合 (如 "20250113_daily")
  date: string;           // 分析日期
  type: 'daily' | 'weekly' | 'stock';  // 分析类型
  stockCode?: string;     // 单只股票分析时的股票代码

  // 分析内容（精简版，避免Token浪费）
  summary: string;        // 关键结论摘要（200字以内）
  topPicks: string[];     // TOP推荐股票代码列表
  hotIndustries: string[]; // 热门行业列表
  riskWarnings: string[]; // 风险提示列表
  marketTrend: 'bullish' | 'bearish' | 'neutral';  // 市场趋势判断

  // 元数据
  createdAt: string;      // 创建时间
  model?: string;         // 使用的AI模型
}

// ==================== 数据库类 ====================

export class StockDatabase extends Dexie {
  stocks!: EntityTable<StockInfo, 'code'>;
  dailyRecords!: EntityTable<DailyRecord, 'id'>;
  dateMetas!: EntityTable<DateMeta, 'date'>;
  aiAnalysisSummaries!: EntityTable<AIAnalysisSummary, 'id'>;

  constructor() {
    super('StockAnalyzerDB');

    this.version(1).stores({
      // 股票基础信息表：code 为主键
      stocks: 'code, name, industry, region',

      // 每日数据表：id 为主键，code 和 date 为索引
      dailyRecords: 'id, code, date, [code+date], change, price',

      // 日期元数据表：date 为主键
      dateMetas: 'date, stockCount'
    });

    // 版本2：添加 AI 分析摘要表
    this.version(2).stores({
      stocks: 'code, name, industry, region',
      dailyRecords: 'id, code, date, [code+date], change, price',
      dateMetas: 'date, stockCount',
      aiAnalysisSummaries: 'id, date, type, stockCode'
    });
  }
}

// 创建数据库单例
export const db = new StockDatabase();

// ==================== 数据库操作服务 ====================

/**
 * 生成每日记录的唯一ID
 */
export function generateDailyRecordId(code: string, date: string): string {
  return `${code}_${date}`;
}

/**
 * 导入股票数据到数据库
 */
export async function importStockData(
  date: string,
  stocks: Array<{
    code: string;
    name: string;
    industry: string;
    region: string;
    price: number;
    open: number;
    high: number;
    low: number;
    change: number;
    volume: number;
    turnover: number;
    amplitude: number;
    pe: number;
    peTTM?: number;
    pb?: number;
    ps?: number;
    marketCap: number;
    change3d?: number;
    change5d?: number;
    change10d?: number;
    change20d?: number;
    change60d?: number;
    changeYear?: number;
    volumeRatio?: number;
    upDays?: number;
    technicalSignal?: string;
    dist5ma?: number;
    grossMargin?: number;
    netMargin?: number;
    debtRatio?: number;
    profitYoy?: number;
    revenueYoy?: number;
    dividendYield?: number;
    formulas: string[];
  }>,
  indexData?: {
    code: string;
    name: string;
    price: number;
    change: number;
  }
): Promise<{ imported: number; updated: number }> {
  const now = new Date().toISOString();
  let imported = 0;
  let updated = 0;

  console.log(`[DB importStockData] 开始导入: 日期=${date}, 股票数=${stocks.length}`);

  await db.transaction('rw', [db.stocks, db.dailyRecords, db.dateMetas], async () => {
    // 收集所有公式名称
    const allFormulas = new Set<string>();

    for (const stock of stocks) {
      // 更新或插入股票基础信息
      await db.stocks.put({
        code: stock.code,
        name: stock.name,
        industry: stock.industry || '',
        region: stock.region || '',
        updatedAt: now
      });

      // 收集公式
      stock.formulas.forEach(f => allFormulas.add(f));

      // 生成记录ID
      const recordId = generateDailyRecordId(stock.code, date);

      // 检查是否已存在
      const existing = await db.dailyRecords.get(recordId);

      // 创建每日记录
      const dailyRecord: DailyRecord = {
        id: recordId,
        code: stock.code,
        date,
        price: stock.price,
        open: stock.open,
        high: stock.high,
        low: stock.low,
        change: stock.change,
        volume: stock.volume,
        turnover: stock.turnover,
        amplitude: stock.amplitude,
        pe: stock.pe,
        peTTM: stock.peTTM,
        pb: stock.pb,
        ps: stock.ps,
        marketCap: stock.marketCap,
        change3d: stock.change3d,
        change5d: stock.change5d,
        change10d: stock.change10d,
        change20d: stock.change20d,
        change60d: stock.change60d,
        changeYear: stock.changeYear,
        volumeRatio: stock.volumeRatio,
        upDays: stock.upDays,
        technicalSignal: stock.technicalSignal,
        dist5ma: stock.dist5ma,
        grossMargin: stock.grossMargin,
        netMargin: stock.netMargin,
        debtRatio: stock.debtRatio,
        profitYoy: stock.profitYoy,
        revenueYoy: stock.revenueYoy,
        dividendYield: stock.dividendYield,
        formulas: stock.formulas,
        createdAt: existing?.createdAt || now
      };

      await db.dailyRecords.put(dailyRecord);

      if (existing) {
        updated++;
      } else {
        imported++;
      }
    }

    // 更新日期元数据
    const dateMetaData = {
      date,
      stockCount: stocks.length,
      formulaCount: allFormulas.size,
      formulas: Array.from(allFormulas),
      indexCode: indexData?.code,
      indexName: indexData?.name,
      indexPrice: indexData?.price,
      indexChange: indexData?.change,
      importedAt: now
    };
    console.log(`[DB importStockData] 保存日期元数据:`, dateMetaData);
    await db.dateMetas.put(dateMetaData);
  });

  console.log(`[DB importStockData] 导入完成: imported=${imported}, updated=${updated}`);

  // 验证数据是否保存成功
  const verifyRecords = await db.dailyRecords.where('date').equals(date).count();
  const verifyDateMeta = await db.dateMetas.get(date);
  console.log(`[DB importStockData] 验证: records=${verifyRecords}, dateMeta=`, verifyDateMeta);

  return { imported, updated };
}

/**
 * 获取所有已导入的日期列表
 */
export async function getAllDates(): Promise<DateMeta[]> {
  return db.dateMetas.orderBy('date').reverse().toArray();
}

/**
 * 获取某个日期的所有股票数据
 */
export async function getStocksByDate(date: string): Promise<DailyRecord[]> {
  return db.dailyRecords.where('date').equals(date).toArray();
}

/**
 * 获取某只股票的所有历史数据
 */
export async function getStockHistory(code: string): Promise<DailyRecord[]> {
  return db.dailyRecords.where('code').equals(code).sortBy('date');
}

/**
 * 获取多只股票的所有历史数据
 */
export async function getStocksHistory(codes: string[]): Promise<Map<string, DailyRecord[]>> {
  const result = new Map<string, DailyRecord[]>();

  const records = await db.dailyRecords
    .where('code')
    .anyOf(codes)
    .toArray();

  // 按股票代码分组
  for (const record of records) {
    const existing = result.get(record.code) || [];
    existing.push(record);
    result.set(record.code, existing);
  }

  // 按日期排序
  for (const [, records] of result) {
    records.sort((a, b) => a.date.localeCompare(b.date));
  }

  return result;
}

/**
 * 获取股票基础信息
 */
export async function getStockInfo(code: string): Promise<StockInfo | undefined> {
  return db.stocks.get(code);
}

/**
 * 获取多只股票的基础信息
 */
export async function getStocksInfo(codes: string[]): Promise<Map<string, StockInfo>> {
  const result = new Map<string, StockInfo>();
  const infos = await db.stocks.where('code').anyOf(codes).toArray();
  for (const info of infos) {
    result.set(info.code, info);
  }
  return result;
}

/**
 * 删除某个日期的所有数据
 */
export async function deleteDate(date: string): Promise<void> {
  await db.transaction('rw', [db.dailyRecords, db.dateMetas], async () => {
    await db.dailyRecords.where('date').equals(date).delete();
    await db.dateMetas.delete(date);
  });
}

/**
 * 清空所有数据
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.stocks, db.dailyRecords, db.dateMetas], async () => {
    await db.stocks.clear();
    await db.dailyRecords.clear();
    await db.dateMetas.clear();
  });
}

/**
 * 获取数据库统计信息
 */
export async function getDBStats(): Promise<{
  stockCount: number;
  recordCount: number;
  dateCount: number;
  oldestDate: string | null;
  newestDate: string | null;
}> {
  const stockCount = await db.stocks.count();
  const recordCount = await db.dailyRecords.count();
  const dates = await db.dateMetas.orderBy('date').toArray();

  return {
    stockCount,
    recordCount,
    dateCount: dates.length,
    oldestDate: dates.length > 0 ? dates[0].date : null,
    newestDate: dates.length > 0 ? dates[dates.length - 1].date : null
  };
}

/**
 * 查找在多个日期都出现的股票
 */
export async function findRepeatedStocks(minDays: number = 2): Promise<Array<{
  code: string;
  name: string;
  appearDates: string[];
  records: DailyRecord[];
}>> {
  // 获取所有股票代码出现的次数
  const codeCounts = new Map<string, string[]>();

  const allRecords = await db.dailyRecords.toArray();
  for (const record of allRecords) {
    const dates = codeCounts.get(record.code) || [];
    if (!dates.includes(record.date)) {
      dates.push(record.date);
    }
    codeCounts.set(record.code, dates);
  }

  // 过滤出现次数 >= minDays 的股票
  const repeatedCodes = Array.from(codeCounts.entries())
    .filter(([, dates]) => dates.length >= minDays)
    .map(([code]) => code);

  // 获取这些股票的详细信息
  const result: Array<{
    code: string;
    name: string;
    appearDates: string[];
    records: DailyRecord[];
  }> = [];

  for (const code of repeatedCodes) {
    const stockInfo = await db.stocks.get(code);
    const records = await db.dailyRecords.where('code').equals(code).sortBy('date');

    result.push({
      code,
      name: stockInfo?.name || code,
      appearDates: codeCounts.get(code) || [],
      records
    });
  }

  // 按出现次数排序
  result.sort((a, b) => b.appearDates.length - a.appearDates.length);

  return result;
}

// ==================== AI 分析摘要服务 ====================

/**
 * 生成 AI 分析摘要 ID
 */
export function generateAnalysisId(date: string, type: 'daily' | 'weekly' | 'stock', stockCode?: string): string {
  if (type === 'stock' && stockCode) {
    return `${date}_${type}_${stockCode}`;
  }
  return `${date}_${type}`;
}

/**
 * 保存 AI 分析摘要
 */
export async function saveAIAnalysisSummary(
  date: string,
  type: 'daily' | 'weekly' | 'stock',
  data: {
    summary: string;
    topPicks?: string[];
    hotIndustries?: string[];
    riskWarnings?: string[];
    marketTrend?: 'bullish' | 'bearish' | 'neutral';
    stockCode?: string;
    model?: string;
  }
): Promise<void> {
  const id = generateAnalysisId(date, type, data.stockCode);

  await db.aiAnalysisSummaries.put({
    id,
    date,
    type,
    stockCode: data.stockCode,
    summary: data.summary.slice(0, 500), // 限制长度
    topPicks: data.topPicks || [],
    hotIndustries: data.hotIndustries || [],
    riskWarnings: data.riskWarnings || [],
    marketTrend: data.marketTrend || 'neutral',
    createdAt: new Date().toISOString(),
    model: data.model
  });

  console.log(`[DB] AI分析摘要已保存: ${id}`);
}

/**
 * 获取某日期的 AI 分析摘要
 */
export async function getAIAnalysisSummary(
  date: string,
  type: 'daily' | 'weekly' | 'stock',
  stockCode?: string
): Promise<AIAnalysisSummary | undefined> {
  const id = generateAnalysisId(date, type, stockCode);
  return db.aiAnalysisSummaries.get(id);
}

/**
 * 获取最近 N 天的 AI 分析摘要
 */
export async function getRecentAIAnalyses(
  type: 'daily' | 'weekly' | 'stock',
  limit: number = 5
): Promise<AIAnalysisSummary[]> {
  return db.aiAnalysisSummaries
    .where('type')
    .equals(type)
    .reverse()
    .sortBy('date')
    .then(results => results.slice(0, limit));
}

/**
 * 获取某只股票的所有 AI 分析摘要
 */
export async function getStockAIAnalyses(stockCode: string): Promise<AIAnalysisSummary[]> {
  return db.aiAnalysisSummaries
    .where('stockCode')
    .equals(stockCode)
    .reverse()
    .sortBy('date');
}

/**
 * 生成用于 AI 参考的历史分析摘要
 * 返回精简的历史分析信息，供新分析时参考
 */
export async function getHistoricalAnalysisContext(limit: number = 3): Promise<string> {
  const recentAnalyses = await getRecentAIAnalyses('daily', limit);

  if (recentAnalyses.length === 0) {
    return '';
  }

  const contextLines = recentAnalyses.map(a => {
    const trend = a.marketTrend === 'bullish' ? '看涨' : a.marketTrend === 'bearish' ? '看跌' : '中性';
    const picks = a.topPicks.length > 0 ? `推荐:${a.topPicks.slice(0, 3).join(',')}` : '';
    const industries = a.hotIndustries.length > 0 ? `热门行业:${a.hotIndustries.slice(0, 2).join(',')}` : '';
    return `[${a.date}] ${trend} ${picks} ${industries} | ${a.summary.slice(0, 100)}`;
  });

  return `\n## 近期AI分析记录（供参考对比）：\n${contextLines.join('\n')}`;
}

// 导出数据库实例和类型
export default db;
