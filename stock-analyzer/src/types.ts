// 股票数据类型
export interface Stock {
  code: string;
  name: string;
  change: number;      // 涨跌幅%
  price: number;       // 现价
  volume: number;      // 成交量
  turnover: number;    // 换手率%
  pe: number;          // 市盈率(动)
  marketCap: number;   // 流通市值(亿)
  industry: string;    // 细分行业
  region: string;      // 地区
  amplitude: number;   // 振幅%
  high: number;        // 最高
  low: number;         // 最低
  open: number;        // 开盘
  
  // === 新增：多日涨幅趋势 ===
  change3d?: number;   // 3日涨幅%
  change5d?: number;   // 5日涨幅%
  change10d?: number;  // 10日涨幅%
  change20d?: number;  // 20日涨幅%
  change60d?: number;  // 60日涨幅%
  changeYear?: number; // 一年涨幅%
  
  // === 新增：技术指标 ===
  volumeRatio?: number;      // 量比
  upDays?: number;           // 连涨天
  technicalSignal?: string;  // 近日指标提示 (如"EXPMA金叉")
  dist5ma?: number;          // 距5日线%
  
  // === 新增：估值指标 ===
  peTTM?: number;      // 市盈率TTM
  pb?: number;         // 市净率
  ps?: number;         // 市销率
  
  // === 新增：财务指标 ===
  grossMargin?: number;    // 毛利率%
  netMargin?: number;      // 净利率%
  debtRatio?: number;      // 资产负债率%
  profitYoy?: number;      // 利润同比%
  revenueYoy?: number;     // 收入同比%
  dividendYield?: number;  // 股息率%
}

// 分组数据
export interface StockGroup {
  name: string;
  stocks: Stock[];
}

// 日期数据
export interface DayData {
  date: string;
  index?: Stock;       // 大盘指数
  groups: StockGroup[];
  allStocks: Stock[];
}

// 多日追踪的股票
export interface TrackedStock extends Stock {
  appearDays: number;        // 出现天数
  formulas: string[];        // 出现的公式
  dates: string[];           // 出现的日期
  changeHistory: number[];   // 涨跌历史
}

// 分析结果
export interface AnalysisResult {
  totalStocks: number;
  upCount: number;
  downCount: number;
  avgChange: number;
  maxChange: number;
  minChange: number;
  industryDistribution: { name: string; count: number }[];
  formulaPerformance: { name: string; avgChange: number; count: number }[];
}
