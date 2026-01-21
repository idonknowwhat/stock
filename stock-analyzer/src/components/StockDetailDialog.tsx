import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, TrendingUp, TrendingDown, Minus, Activity, BarChart3, PieChart, AlertTriangle, CheckCircle, Info, Loader2, Send, Trash2, DollarSign, Target, Shield, LineChart, Factory, MessageSquare, History, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Stock } from '../types';
import { loadSettings } from './SettingsDialog';
import { loadChatHistory, saveChatMessage, clearChatHistory, type ChatMessage } from '../utils/chatHistoryService';
import { getStockHistory, type DailyRecord } from '../db/index';

interface StockDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stock: Stock | null;
}

// 趋势指示器
function TrendIndicator({ value, threshold = 0 }: { value: number | undefined; threshold?: number }) {
  if (value === undefined) return <span className="text-slate-400">-</span>;

  const color = value > threshold ? 'text-red-600' : value < -threshold ? 'text-green-600' : 'text-slate-600';
  const Icon = value > threshold ? TrendingUp : value < -threshold ? TrendingDown : Minus;

  return (
    <span className={`flex items-center gap-1 font-medium ${color}`}>
      <Icon className="w-4 h-4" />
      {value > 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

// 本地分析函数 - 增强版
function analyzeStock(stock: Stock): {
  signals: { type: 'positive' | 'negative' | 'neutral'; text: string }[];
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
  priceAdvice: {
    buyPrice: number | null;
    sellPrice: number | null;
    stopLoss: number | null;
    buyReason: string;
    sellReason: string;
  };
} {
  const signals: { type: 'positive' | 'negative' | 'neutral'; text: string }[] = [];
  let riskScore = 0;

  // ========== 涨跌幅分析 ==========
  if (stock.change >= 9.5) {
    signals.push({ type: 'neutral', text: '涨停板，追高风险较大' });
    riskScore += 2;
  } else if (stock.change >= 5) {
    signals.push({ type: 'positive', text: '强势上涨，短期动能充足' });
  } else if (stock.change >= 2) {
    signals.push({ type: 'positive', text: '温和上涨，走势健康' });
  } else if (stock.change <= -5) {
    signals.push({ type: 'negative', text: '大幅下跌，注意风险' });
    riskScore += 2;
  } else if (stock.change <= -2) {
    signals.push({ type: 'negative', text: '明显回调，观望为宜' });
    riskScore += 1;
  }

  // ========== 换手率分析 ==========
  if (stock.turnover > 15) {
    signals.push({ type: 'negative', text: `换手率${stock.turnover.toFixed(1)}%过高，可能有主力出货` });
    riskScore += 2;
  } else if (stock.turnover > 8) {
    signals.push({ type: 'neutral', text: `换手率${stock.turnover.toFixed(1)}%偏高，交投活跃` });
    riskScore += 1;
  } else if (stock.turnover < 1) {
    signals.push({ type: 'negative', text: `换手率${stock.turnover.toFixed(1)}%过低，流动性不足` });
    riskScore += 1;
  } else if (stock.turnover >= 3 && stock.turnover <= 8) {
    signals.push({ type: 'positive', text: `换手率${stock.turnover.toFixed(1)}%适中，交易活跃` });
  }

  // ========== 振幅分析 ==========
  if (stock.amplitude > 10) {
    signals.push({ type: 'negative', text: `振幅${stock.amplitude.toFixed(1)}%过大，波动剧烈` });
    riskScore += 2;
  } else if (stock.amplitude > 5) {
    signals.push({ type: 'neutral', text: `振幅${stock.amplitude.toFixed(1)}%较大，需注意波动` });
    riskScore += 1;
  }

  // ========== 多日趋势分析 ==========
  const c5 = stock.change5d || 0;
  const c20 = stock.change20d || 0;

  if (c5 > 10 && c20 > 20) {
    signals.push({ type: 'positive', text: '短中期均处于强势上升通道' });
  } else if (c5 > 5 && c20 > 0) {
    signals.push({ type: 'positive', text: '短期强势，中期趋势向好' });
  } else if (c5 < -5 && c20 < -10) {
    signals.push({ type: 'negative', text: '短中期均处于下降趋势' });
    riskScore += 2;
  } else if (c5 > 0 && c20 < -5) {
    signals.push({ type: 'neutral', text: '短期反弹，中期仍在调整' });
    riskScore += 1;
  }

  // ========== 估值分析 ==========
  if (stock.pe && stock.pe > 0) {
    if (stock.pe > 100) {
      signals.push({ type: 'negative', text: `市盈率${stock.pe.toFixed(1)}倍偏高，估值压力大` });
      riskScore += 1;
    } else if (stock.pe < 15 && stock.pe > 0) {
      signals.push({ type: 'positive', text: `市盈率${stock.pe.toFixed(1)}倍较低，估值合理` });
    }
  }

  // ========== 价格区间分析 ==========
  if (stock.price > 100) {
    signals.push({ type: 'neutral', text: `高价股(¥${stock.price.toFixed(2)})，波动可能较大` });
  } else if (stock.price < 5) {
    signals.push({ type: 'neutral', text: `低价股(¥${stock.price.toFixed(2)})，注意基本面风险` });
    riskScore += 1;
  }

  // ========== 技术信号分析（增强） ==========
  if (stock.technicalSignal) {
    const signal = stock.technicalSignal;
    if (signal.includes('金叉') || signal.includes('突破')) {
      signals.push({ type: 'positive', text: `技术信号: ${signal}` });
    } else if (signal.includes('死叉') || signal.includes('跌破')) {
      signals.push({ type: 'negative', text: `技术信号: ${signal}` });
      riskScore += 1;
      // 如果涨停但有死叉，特别警告
      if (stock.change >= 9.5) {
        signals.push({ type: 'negative', text: '⚠️ 涨停与技术指标背离，追高需谨慎' });
        riskScore += 1;
      }
    } else {
      signals.push({ type: 'neutral', text: `技术信号: ${signal}` });
    }
  }

  // ========== 风险等级判定 ==========
  const riskLevel: 'low' | 'medium' | 'high' = riskScore >= 4 ? 'high' : riskScore >= 2 ? 'medium' : 'low';

  // ========== 生成总结 ==========
  const positiveCount = signals.filter(s => s.type === 'positive').length;
  const negativeCount = signals.filter(s => s.type === 'negative').length;

  let summary = '';
  if (positiveCount > negativeCount + 1) {
    summary = '综合来看，该股票多项指标表现积极，短期可关注。';
  } else if (negativeCount > positiveCount + 1) {
    summary = '综合来看，该股票存在多项风险信号，建议谨慎观望。';
  } else {
    summary = '综合来看，该股票信号混合，建议结合大盘和板块走势综合判断。';
  }

  // ========== 计算建议买卖价 ==========
  const priceAdvice = calculatePriceAdvice(stock, riskLevel);

  return { signals, riskLevel, summary, priceAdvice };
}

// 计算建议买卖价
function calculatePriceAdvice(stock: Stock, riskLevel: 'low' | 'medium' | 'high'): {
  buyPrice: number | null;
  sellPrice: number | null;
  stopLoss: number | null;
  buyReason: string;
  sellReason: string;
} {
  const { price, high, low, open, change } = stock;

  let buyPrice: number | null = null;
  let sellPrice: number | null = null;
  let stopLoss: number | null = null;
  let buyReason = '';
  let sellReason = '';

  // 涨停板：不建议追高
  if (change >= 9.5) {
    buyPrice = null;
    buyReason = '涨停板，不建议追高买入';
    // 止盈位：次日开盘如果高开可考虑卖出
    sellPrice = Math.round(price * 1.03 * 100) / 100;
    sellReason = '涨停次日若高开3%以上可考虑止盈';
    stopLoss = Math.round(low * 0.97 * 100) / 100;
  }
  // 跌停板
  else if (change <= -9.5) {
    buyPrice = null;
    buyReason = '跌停板，不建议抄底';
    sellPrice = null;
    sellReason = '跌停板，卖出困难';
    stopLoss = null;
  }
  // 强势上涨 (5-9.5%)
  else if (change >= 5) {
    // 回调到今日均价附近买入
    const avgPrice = (high + low + open + price) / 4;
    buyPrice = Math.round(avgPrice * 0.98 * 100) / 100;
    buyReason = `回调到均价附近¥${buyPrice}可考虑买入`;
    // 止盈位
    sellPrice = Math.round(high * 1.05 * 100) / 100;
    sellReason = `突破今日高点5%即¥${sellPrice}可考虑止盈`;
    stopLoss = Math.round(low * 0.97 * 100) / 100;
  }
  // 温和上涨 (2-5%)
  else if (change >= 2) {
    buyPrice = Math.round(price * 0.97 * 100) / 100;
    buyReason = `回调3%到¥${buyPrice}可考虑买入`;
    sellPrice = Math.round(price * 1.08 * 100) / 100;
    sellReason = `上涨8%到¥${sellPrice}可考虑止盈`;
    stopLoss = Math.round(price * 0.93 * 100) / 100;
  }
  // 小幅波动 (-2% ~ 2%)
  else if (change >= -2 && change < 2) {
    buyPrice = Math.round(low * 0.99 * 100) / 100;
    buyReason = `跌破今日低点可考虑在¥${buyPrice}附近建仓`;
    sellPrice = Math.round(high * 1.03 * 100) / 100;
    sellReason = `突破今日高点可考虑在¥${sellPrice}止盈`;
    stopLoss = Math.round(low * 0.95 * 100) / 100;
  }
  // 明显下跌 (-5% ~ -2%)
  else if (change >= -5) {
    buyPrice = Math.round(low * 0.98 * 100) / 100;
    buyReason = `企稳后可在¥${buyPrice}附近试探性买入`;
    sellPrice = Math.round(price * 1.05 * 100) / 100;
    sellReason = `反弹5%到¥${sellPrice}可考虑减仓`;
    stopLoss = Math.round(low * 0.95 * 100) / 100;
  }
  // 大幅下跌 (<-5%)
  else {
    buyPrice = null;
    buyReason = '大幅下跌中，不建议抄底，等待企稳';
    sellPrice = Math.round(price * 1.03 * 100) / 100;
    sellReason = `反弹3%到¥${sellPrice}可考虑减仓止损`;
    stopLoss = Math.round(price * 0.95 * 100) / 100;
  }

  // 根据风险等级调整
  if (riskLevel === 'high' && buyPrice) {
    buyReason += '（高风险，建议轻仓）';
  }

  return { buyPrice, sellPrice, stopLoss, buyReason, sellReason };
}

// 计算长期卖出价建议
function calculateLongTermAdvice(stock: Stock): {
  weekTarget: number | null;
  monthTarget: number | null;
  quarterTarget: number | null;
  weekReason: string;
  monthReason: string;
  quarterReason: string;
} {
  const { price, change5d, change20d, change60d, pe } = stock;

  // 基于历史趋势和估值计算长期目标价
  const c5 = change5d || 0;
  const c20 = change20d || 0;
  const c60 = change60d || 0;

  // 周线目标（1-2周）
  let weekTarget: number | null = null;
  let weekReason = '';

  // 月线目标（1个月）
  let monthTarget: number | null = null;
  let monthReason = '';

  // 季度目标（3个月）
  let quarterTarget: number | null = null;
  let quarterReason = '';

  // 计算平均日涨幅
  const avgDailyChange5 = c5 / 5;
  const avgDailyChange20 = c20 / 20;
  const avgDailyChange60 = c60 / 60;

  // 强势上涨趋势
  if (c5 > 5 && c20 > 10) {
    // 周目标：保守估计维持当前势头的一半
    const weekGain = Math.min(avgDailyChange5 * 5, 15); // 最多15%
    weekTarget = Math.round(price * (1 + weekGain / 100) * 100) / 100;
    weekReason = `维持强势，预计周涨幅${weekGain.toFixed(1)}%`;

    // 月目标：趋势减缓
    const monthGain = Math.min(avgDailyChange20 * 15, 25); // 最多25%
    monthTarget = Math.round(price * (1 + monthGain / 100) * 100) / 100;
    monthReason = `趋势延续，预计月涨幅${monthGain.toFixed(1)}%`;

    // 季度目标
    const quarterGain = Math.min(avgDailyChange60 * 30 || monthGain * 1.5, 40); // 最多40%
    quarterTarget = Math.round(price * (1 + quarterGain / 100) * 100) / 100;
    quarterReason = `长线持有，预计季度涨幅${quarterGain.toFixed(1)}%`;
  }
  // 温和上涨
  else if (c5 > 0 && c20 > 0) {
    const weekGain = Math.max(3, avgDailyChange5 * 5 * 0.7);
    weekTarget = Math.round(price * (1 + weekGain / 100) * 100) / 100;
    weekReason = `温和上涨，预计周涨幅${weekGain.toFixed(1)}%`;

    const monthGain = Math.max(5, avgDailyChange20 * 10);
    monthTarget = Math.round(price * (1 + monthGain / 100) * 100) / 100;
    monthReason = `稳健持有，预计月涨幅${monthGain.toFixed(1)}%`;

    const quarterGain = Math.max(10, (avgDailyChange60 || avgDailyChange20) * 25);
    quarterTarget = Math.round(price * (1 + quarterGain / 100) * 100) / 100;
    quarterReason = `价值投资，预计季度涨幅${quarterGain.toFixed(1)}%`;
  }
  // 震荡或下跌趋势
  else if (c20 < 0) {
    // 反弹目标
    weekTarget = Math.round(price * 1.05 * 100) / 100;
    weekReason = '等待反弹，反弹5%可考虑减仓';

    monthTarget = Math.round(price * 1.10 * 100) / 100;
    monthReason = '若企稳反转，反弹10%可止盈';

    quarterTarget = null;
    quarterReason = '中期趋势不明，不建议长期持有';
  }
  // 短期回调但中期向好
  else if (c5 < 0 && c20 > 0) {
    weekTarget = Math.round(price * 1.05 * 100) / 100;
    weekReason = '短期回调，反弹5%可考虑减仓';

    const monthGain = Math.max(8, avgDailyChange20 * 10);
    monthTarget = Math.round(price * (1 + monthGain / 100) * 100) / 100;
    monthReason = `回调后继续上涨，预计月涨幅${monthGain.toFixed(1)}%`;

    quarterTarget = Math.round(price * 1.20 * 100) / 100;
    quarterReason = '中期趋势向好，可长线持有';
  }
  // 默认情况
  else {
    weekTarget = Math.round(price * 1.05 * 100) / 100;
    weekReason = '保守估计周涨5%';

    monthTarget = Math.round(price * 1.10 * 100) / 100;
    monthReason = '保守估计月涨10%';

    quarterTarget = Math.round(price * 1.15 * 100) / 100;
    quarterReason = '保守估计季度涨15%';
  }

  // PE估值修正
  if (pe && pe > 0) {
    if (pe > 80) {
      // 高估值，降低目标
      if (weekTarget) weekTarget = Math.round(weekTarget * 0.95 * 100) / 100;
      if (monthTarget) monthTarget = Math.round(monthTarget * 0.90 * 100) / 100;
      quarterReason = quarterTarget ? '高估值风险，建议适时止盈' : quarterReason;
    } else if (pe < 20 && pe > 0) {
      // 低估值，可适当提高目标
      if (monthTarget) monthTarget = Math.round(monthTarget * 1.05 * 100) / 100;
      if (quarterTarget) quarterTarget = Math.round(quarterTarget * 1.10 * 100) / 100;
    }
  }

  return {
    weekTarget,
    monthTarget,
    quarterTarget,
    weekReason,
    monthReason,
    quarterReason
  };
}

// 计算支撑位和压力位
function calculateSupportResistance(stock: Stock, historyRecords: DailyRecord[]): {
  support1: number;
  support2: number;
  resistance1: number;
  resistance2: number;
  pivotPoint: number;
} {
  const { price, high, low } = stock;

  // 经典轴心点计算 (Pivot Point)
  const pivotPoint = (high + low + price) / 3;

  // 第一支撑位和压力位
  const resistance1 = 2 * pivotPoint - low;
  const support1 = 2 * pivotPoint - high;

  // 第二支撑位和压力位
  const resistance2 = pivotPoint + (high - low);
  const support2 = pivotPoint - (high - low);

  // 如果有历史数据，结合历史高低点进行优化
  if (historyRecords.length > 1) {
    const recentRecords = historyRecords.slice(0, 5); // 最近5天
    const historicalHighs = recentRecords.map(r => r.high || r.price * 1.02);
    const historicalLows = recentRecords.map(r => r.low || r.price * 0.98);

    const maxHigh = Math.max(...historicalHighs);
    const minLow = Math.min(...historicalLows);

    // 调整压力位：取计算值和历史高点的较高者
    const adjustedResistance1 = Math.max(resistance1, maxHigh * 0.99);
    // 调整支撑位：取计算值和历史低点的较低者
    const adjustedSupport1 = Math.min(support1, minLow * 1.01);

    return {
      support1: Math.round(adjustedSupport1 * 100) / 100,
      support2: Math.round(support2 * 100) / 100,
      resistance1: Math.round(adjustedResistance1 * 100) / 100,
      resistance2: Math.round(resistance2 * 100) / 100,
      pivotPoint: Math.round(pivotPoint * 100) / 100,
    };
  }

  return {
    support1: Math.round(support1 * 100) / 100,
    support2: Math.round(support2 * 100) / 100,
    resistance1: Math.round(resistance1 * 100) / 100,
    resistance2: Math.round(resistance2 * 100) / 100,
    pivotPoint: Math.round(pivotPoint * 100) / 100,
  };
}

// 生成系统提示词
function generateSystemPrompt(
  stock: Stock,
  supportResistance?: { support1: number; support2: number; resistance1: number; resistance2: number; pivotPoint: number },
  historyRecords?: DailyRecord[]
): string {
  // 历史数据摘要
  let historyInfo = '';
  if (historyRecords && historyRecords.length > 1) {
    const sortedHistory = [...historyRecords].sort((a, b) => b.date.localeCompare(a.date));
    const historyList = sortedHistory.slice(0, 5).map(r =>
      `  - ${r.date}: ¥${r.price.toFixed(2)} (${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%)`
    ).join('\n');
    historyInfo = `\n## 历史上榜记录（共${historyRecords.length}次）：\n${historyList}`;
  }

  // 支撑压力位信息
  let srInfo = '';
  if (supportResistance) {
    srInfo = `\n## 技术支撑/压力位（基于轴心点计算）：
- 轴心点: ¥${supportResistance.pivotPoint}
- 第一压力位: ¥${supportResistance.resistance1}
- 第二压力位: ¥${supportResistance.resistance2}
- 第一支撑位: ¥${supportResistance.support1}
- 第二支撑位: ¥${supportResistance.support2}`;
  }

  return `你是一位资深的A股股票分析师，拥有10年以上的投资经验。你精通技术分析、基本面分析和行业研究。

## 你的专业能力包括：
- 深入的技术面分析（K线形态、均线系统、量价关系、技术指标）
- 全面的基本面研究（财务分析、估值模型、行业研究）
- 敏锐的市场洞察（政策解读、资金流向、市场情绪）
- 严谨的风险管理（仓位控制、止损策略、风险评估）

## 当前分析的股票：
- **名称**: ${stock.name}
- **代码**: ${stock.code}
- **行业**: ${stock.industry || '未知'}
- **地区**: ${stock.region || '未知'}
- **现价**: ¥${stock.price.toFixed(2)}
- **涨跌幅**: ${stock.change >= 0 ? '+' : ''}${stock.change.toFixed(2)}%
- **换手率**: ${stock.turnover.toFixed(2)}%
- **振幅**: ${stock.amplitude.toFixed(2)}%
- **量比**: ${stock.volumeRatio?.toFixed(2) || '-'}
- **5日涨幅**: ${stock.change5d ? `${stock.change5d > 0 ? '+' : ''}${stock.change5d.toFixed(2)}%` : '-'}
- **20日涨幅**: ${stock.change20d ? `${stock.change20d > 0 ? '+' : ''}${stock.change20d.toFixed(2)}%` : '-'}
- **市盈率**: ${stock.pe || '-'}
- **市净率**: ${stock.pb || '-'}
- **技术信号**: ${stock.technicalSignal || '无'}
${srInfo}
${historyInfo}

## 你的工作方式：
- 用专业但易懂的语言回答问题
- 给出具体的数据支撑和逻辑推理
- 结合支撑位和压力位给出具体的操作建议
- 提供明确的投资建议和风险提示
- 坦诚说明不确定性，不夸大收益
- 根据用户问题灵活调整分析深度

## 重要提醒：
- 你只讨论股票投资相关话题
- 如果用户问非股票相关问题，礼貌拒绝并引导回股票分析
- 所有分析仅供参考，不构成投资建议

请始终保持专业、客观、负责的态度，帮助投资者做出理性的决策。`;
}

// 快捷问题按钮配置
const quickQuestions = [
  { icon: BarChart3, label: '综合分析', prompt: '请对这只股票进行全面的综合分析，包括技术面、基本面、行业面和风险提示。' },
  { icon: DollarSign, label: '买入价', prompt: '请根据技术分析，给出这只股票的建议买入价位和买入时机。' },
  { icon: Target, label: '卖出价', prompt: '请根据技术分析，给出这只股票的建议卖出价位和止盈位置。' },
  { icon: Shield, label: '风险评估', prompt: '请详细分析这只股票当前的风险点，包括技术风险、基本面风险和市场风险。' },
  { icon: LineChart, label: '技术分析', prompt: '请从技术面角度分析这只股票，包括K线形态、均线系统、量价关系和技术指标。' },
  { icon: Factory, label: '行业分析', prompt: '请分析这只股票所在行业的当前景气度、政策影响和发展前景。' },
];

// 对话消息组件
interface MessageItemProps {
  message: ChatMessage;
}

function MessageItem({ message }: MessageItemProps) {
  return (
    <div className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.role === 'user'
        ? 'bg-purple-600 text-white'
        : 'bg-slate-100 text-slate-800'
        }`}>
        <div className="text-xs opacity-60 mb-1">{message.timestamp}</div>
        {message.role === 'assistant' ? (
          <div className="prose prose-sm prose-slate max-w-none prose-p:my-2 prose-headings:my-2">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        )}
      </div>
    </div>
  );
}

export function StockDetailDialog({ isOpen, onClose, stock }: StockDetailDialogProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 历史数据状态
  const [historyRecords, setHistoryRecords] = useState<DailyRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // 选中的历史日期（用于切换查看不同日期的数据）
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 获取当前显示的数据（当前日期或历史日期）
  const currentRecord = selectedDate
    ? historyRecords.find(r => r.date === selectedDate)
    : null;

  // 当前显示的股票数据（如果有选中的历史日期则显示历史数据）
  const displayStock = stock ? (currentRecord ? {
    ...stock,
    price: currentRecord.price,
    open: currentRecord.open,
    high: currentRecord.high,
    low: currentRecord.low,
    change: currentRecord.change,
    turnover: currentRecord.turnover,
    amplitude: currentRecord.amplitude,
    pe: currentRecord.pe,
    peTTM: currentRecord.peTTM,
    pb: currentRecord.pb,
    ps: currentRecord.ps,
    marketCap: currentRecord.marketCap,
    change5d: currentRecord.change5d,
    change10d: currentRecord.change10d,
    change20d: currentRecord.change20d,
    change60d: currentRecord.change60d,
    volumeRatio: currentRecord.volumeRatio,
    upDays: currentRecord.upDays,
    technicalSignal: currentRecord.technicalSignal,
    grossMargin: currentRecord.grossMargin,
    netMargin: currentRecord.netMargin,
    debtRatio: currentRecord.debtRatio,
    profitYoy: currentRecord.profitYoy,
    revenueYoy: currentRecord.revenueYoy,
    dividendYield: currentRecord.dividendYield,
  } : stock) : null;

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 加载历史对话
  useEffect(() => {
    if (isOpen && stock) {
      loadChatHistory(stock.code, stock.name).then(history => {
        setMessages(history);
        setTimeout(scrollToBottom, 100);
      });
    }
  }, [isOpen, stock?.code]);

  // 加载股票历史数据
  useEffect(() => {
    if (isOpen && stock) {
      setHistoryLoading(true);
      getStockHistory(stock.code)
        .then(records => {
          // 按日期降序排列
          setHistoryRecords(records.sort((a, b) => b.date.localeCompare(a.date)));
        })
        .finally(() => setHistoryLoading(false));
    }
  }, [isOpen, stock?.code]);

  // 消息变化时滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 发送消息
  const sendMessage = async (content: string) => {
    if (!stock || !content.trim() || isLoading) return;

    const settings = loadSettings();
    if (!settings.apiKey || !settings.selectedModel) {
      setError('请先在设置中配置 API Key 和选择模型');
      return;
    }

    const timestamp = new Date().toLocaleString('zh-CN', {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // 添加用户消息
    const userMessage: ChatMessage = { role: 'user', content: content.trim(), timestamp };
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setIsLoading(true);
    setError('');

    // 保存用户消息到文件
    saveChatMessage(stock.code, stock.name, 'user', content.trim());

    try {
      // 计算支撑位和压力位
      const supportResistance = calculateSupportResistance(stock, historyRecords);

      // 构建完整的对话历史
      const apiMessages = [
        { role: 'system' as const, content: generateSystemPrompt(stock, supportResistance, historyRecords) },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: content.trim() }
      ];

      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || '未获取到回复';

      const assistantTimestamp = new Date().toLocaleString('zh-CN', {
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        timestamp: assistantTimestamp
      };

      setMessages(prev => [...prev, assistantMessage]);

      // 保存AI回复到文件
      saveChatMessage(stock.code, stock.name, 'assistant', assistantContent);
    } catch (e) {
      setError(`发送失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 清除对话
  const handleClearChat = async () => {
    if (!stock) return;
    if (window.confirm('确定要清除所有对话历史吗？此操作不可恢复。')) {
      await clearChatHistory(stock.code, stock.name);
      setMessages([]);
    }
  };

  if (!isOpen || !stock || !displayStock) return null;

  // 使用选中日期的数据进行分析
  const analysis = analyzeStock(displayStock);
  const supportResistance = calculateSupportResistance(displayStock, historyRecords);
  const longTermAdvice = calculateLongTermAdvice(displayStock);

  const riskColors = {
    low: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    high: 'bg-red-100 text-red-700 border-red-200',
  };
  const riskLabels = { low: '低风险', medium: '中风险', high: '高风险' };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // 点击背景关闭弹窗
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{stock.name}</h2>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-slate-500">{stock.code}</span>
                {stock.industry && (
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded">{stock.industry}</span>
                )}
                {stock.region && (
                  <span className="text-slate-400">{stock.region}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-slate-800">¥{displayStock.price.toFixed(2)}</div>
              <TrendIndicator value={displayStock.change} />
              {selectedDate && (
                <div className="text-xs text-purple-600 mt-1">
                  查看: {selectedDate}
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="ml-2 text-slate-400 hover:text-slate-600"
                  >
                    [返回今日]
                  </button>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* 内容区 - 三栏布局 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 左侧：数据面板 */}
          <div className="w-64 overflow-auto p-3 border-r border-slate-200 shrink-0 space-y-3">
            {/* 日期选择器（如果有多个历史记录） */}
            {historyRecords.length > 1 && (
              <div className="bg-purple-50 rounded-xl p-3 border border-purple-200">
                <h3 className="flex items-center gap-2 font-semibold text-purple-700 mb-2 text-sm">
                  <Calendar className="w-4 h-4" />
                  选择日期
                </h3>
                <div className="flex flex-wrap gap-1">
                  {historyRecords.map((record, i) => (
                    <button
                      key={record.date}
                      onClick={() => setSelectedDate(i === 0 ? null : record.date)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        (selectedDate === null && i === 0) || selectedDate === record.date
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-purple-700 hover:bg-purple-100'
                      }`}
                    >
                      {record.date}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 多日趋势 */}
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                多日趋势
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '5日', value: displayStock.change5d },
                  { label: '10日', value: displayStock.change10d },
                  { label: '20日', value: displayStock.change20d },
                  { label: '60日', value: displayStock.change60d },
                ].map(item => (
                  <div key={item.label} className="text-center p-1.5 bg-white rounded-lg">
                    <div className="text-xs text-slate-500 mb-0.5">{item.label}</div>
                    <TrendIndicator value={item.value} />
                  </div>
                ))}
              </div>
            </div>

            {/* 交易数据 */}
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2 text-sm">
                <Activity className="w-4 h-4" />
                交易数据
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: '换手率', value: `${displayStock.turnover.toFixed(2)}%` },
                  { label: '振幅', value: `${displayStock.amplitude.toFixed(2)}%` },
                  { label: '量比', value: displayStock.volumeRatio?.toFixed(2) || '-' },
                  { label: '连涨天', value: displayStock.upDays ?? '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 估值指标 */}
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2 text-sm">
                <BarChart3 className="w-4 h-4" />
                估值指标
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: '市盈率(动)', value: displayStock.pe || '-' },
                  { label: 'PE(TTM)', value: displayStock.peTTM || '-' },
                  { label: '市净率', value: displayStock.pb || '-' },
                  { label: '市销率', value: displayStock.ps || '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 财务指标 */}
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2 text-sm">
                <PieChart className="w-4 h-4" />
                财务指标
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: '毛利率', value: displayStock.grossMargin ? `${displayStock.grossMargin.toFixed(1)}%` : '-' },
                  { label: '净利率', value: displayStock.netMargin ? `${displayStock.netMargin.toFixed(1)}%` : '-' },
                  { label: '负债率', value: displayStock.debtRatio ? `${displayStock.debtRatio.toFixed(1)}%` : '-' },
                  { label: '股息率', value: displayStock.dividendYield ? `${displayStock.dividendYield.toFixed(2)}%` : '-' },
                  { label: '利润同比', value: displayStock.profitYoy ? `${displayStock.profitYoy > 0 ? '+' : ''}${displayStock.profitYoy.toFixed(1)}%` : '-' },
                  { label: '收入同比', value: displayStock.revenueYoy ? `${displayStock.revenueYoy > 0 ? '+' : ''}${displayStock.revenueYoy.toFixed(1)}%` : '-' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                    <span className="text-slate-500">{item.label}</span>
                    <span className="font-medium text-slate-700">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 中间：AI 对话区域 */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* AI 标题栏 */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-semibold text-purple-800">
                  <Sparkles className="w-5 h-5" />
                  AI 股票分析师
                </h3>
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    清除对话
                  </button>
                )}
              </div>
            </div>

            {/* 快捷按钮 */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="flex flex-wrap gap-1.5">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q.prompt)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700 transition-colors disabled:opacity-50"
                  >
                    <q.icon className="w-3.5 h-3.5" />
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 对话消息区 */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {messages.length === 0 && !error && (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-purple-200 mx-auto mb-3" />
                  <p className="text-slate-600 mb-1 font-medium text-sm">与AI分析师对话</p>
                  <p className="text-xs text-slate-500">
                    点击上方快捷按钮或输入您的问题
                  </p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <MessageItem key={idx} message={msg} />
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-2xl px-4 py-3">
                    <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex justify-center">
                  <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                    {error}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="px-4 py-2.5 border-t border-slate-200 bg-white shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(userInput);
                    }
                  }}
                  placeholder="输入您的问题，例如：这只股票适合长期持有吗？"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none disabled:bg-slate-100 text-sm"
                />
                <button
                  onClick={() => sendMessage(userInput)}
                  disabled={isLoading || !userInput.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：智能分析面板 */}
          <div className="w-72 border-l border-slate-200 shrink-0 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* 本地智能分析 */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 font-semibold text-indigo-800 text-sm">
                  <Info className="w-4 h-4" />
                  智能分析
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${riskColors[analysis.riskLevel]}`}>
                  {riskLabels[analysis.riskLevel]}
                </span>
              </div>

              <div className="space-y-2 mb-3">
                {analysis.signals.map((signal, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded-lg text-xs ${signal.type === 'positive' ? 'bg-green-50 text-green-700' :
                      signal.type === 'negative' ? 'bg-red-50 text-red-700' :
                        'bg-slate-50 text-slate-600'
                      }`}
                  >
                    {signal.type === 'positive' ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> :
                      signal.type === 'negative' ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> :
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                    <span>{signal.text}</span>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-white/60 rounded-lg text-xs text-slate-600">
                {analysis.summary}
              </div>
            </div>

            {/* 买卖建议 */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
              <h3 className="flex items-center gap-2 font-semibold text-emerald-800 mb-3 text-sm">
                <Target className="w-4 h-4" />
                操作建议
              </h3>
              <div className="space-y-2">
                {/* 买入价 */}
                <div className="p-2.5 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-green-600" />
                      建议买入价
                    </span>
                    <span className="font-bold text-green-600">
                      {analysis.priceAdvice.buyPrice ? `¥${analysis.priceAdvice.buyPrice}` : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{analysis.priceAdvice.buyReason}</p>
                </div>
                {/* 卖出价 */}
                <div className="p-2.5 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Target className="w-3 h-3 text-red-600" />
                      建议卖出价
                    </span>
                    <span className="font-bold text-red-600">
                      {analysis.priceAdvice.sellPrice ? `¥${analysis.priceAdvice.sellPrice}` : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{analysis.priceAdvice.sellReason}</p>
                </div>
                {/* 止损价 */}
                {analysis.priceAdvice.stopLoss && (
                  <div className="p-2.5 bg-white rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-amber-600" />
                        止损价位
                      </span>
                      <span className="font-bold text-amber-600">¥{analysis.priceAdvice.stopLoss}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 长期目标价 */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-100">
              <h3 className="flex items-center gap-2 font-semibold text-rose-800 mb-3 text-sm">
                <TrendingUp className="w-4 h-4" />
                长期目标价
              </h3>
              <div className="space-y-2">
                {/* 周目标 */}
                <div className="p-2.5 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">周目标 (1-2周)</span>
                    <span className="font-bold text-rose-600">
                      {longTermAdvice.weekTarget ? `¥${longTermAdvice.weekTarget}` : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{longTermAdvice.weekReason}</p>
                </div>
                {/* 月目标 */}
                <div className="p-2.5 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">月目标 (1个月)</span>
                    <span className="font-bold text-rose-600">
                      {longTermAdvice.monthTarget ? `¥${longTermAdvice.monthTarget}` : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{longTermAdvice.monthReason}</p>
                </div>
                {/* 季度目标 */}
                <div className="p-2.5 bg-white rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">季度目标 (3个月)</span>
                    <span className="font-bold text-rose-600">
                      {longTermAdvice.quarterTarget ? `¥${longTermAdvice.quarterTarget}` : '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{longTermAdvice.quarterReason}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-rose-200 text-xs text-rose-500">
                * 长期目标基于当前趋势和估值预估，仅供参考
              </div>
            </div>

            {/* 支撑位/压力位 */}
            <div className="bg-gradient-to-br from-sky-50 to-cyan-50 rounded-xl p-4 border border-sky-100">
              <h3 className="flex items-center gap-2 font-semibold text-sky-800 mb-3 text-sm">
                <Activity className="w-4 h-4" />
                支撑/压力位
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-lg text-center">
                    <div className="text-xs text-slate-500 mb-0.5">第一压力位</div>
                    <div className="font-bold text-red-600">¥{supportResistance.resistance1}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg text-center">
                    <div className="text-xs text-slate-500 mb-0.5">第二压力位</div>
                    <div className="font-bold text-red-500">¥{supportResistance.resistance2}</div>
                  </div>
                </div>
                <div className="p-2 bg-sky-100 rounded-lg text-center">
                  <div className="text-xs text-sky-600 mb-0.5">轴心点</div>
                  <div className="font-bold text-sky-700">¥{supportResistance.pivotPoint}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-lg text-center">
                    <div className="text-xs text-slate-500 mb-0.5">第一支撑位</div>
                    <div className="font-bold text-green-600">¥{supportResistance.support1}</div>
                  </div>
                  <div className="p-2 bg-white rounded-lg text-center">
                    <div className="text-xs text-slate-500 mb-0.5">第二支撑位</div>
                    <div className="font-bold text-green-500">¥{supportResistance.support2}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 历史记录 */}
            {historyRecords.length > 1 && (
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
                <h3 className="flex items-center gap-2 font-semibold text-violet-800 mb-3 text-sm">
                  <History className="w-4 h-4" />
                  历史上榜 ({historyRecords.length}次)
                </h3>
                {historyLoading ? (
                  <div className="text-center py-3">
                    <Loader2 className="w-5 h-5 animate-spin text-violet-400 mx-auto" />
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-auto">
                    {historyRecords.map((record, i) => (
                      <div key={record.date} className={`flex items-center justify-between p-2 rounded-lg text-xs ${i === 0 ? 'bg-violet-100' : 'bg-white'}`}>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-violet-500" />
                          <span className="font-medium text-violet-700">{record.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">¥{record.price.toFixed(2)}</span>
                          <span className={`font-medium ${record.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {record.change >= 0 ? '+' : ''}{record.change.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {historyRecords.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-violet-200 text-xs text-violet-600">
                    首次上榜: {historyRecords[historyRecords.length - 1].date}
                  </div>
                )}
              </div>
            )}

            {/* 技术信号 */}
            {stock.technicalSignal && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <h3 className="flex items-center gap-2 font-semibold text-amber-800 mb-2 text-sm">
                  <LineChart className="w-4 h-4" />
                  技术信号
                </h3>
                <div className="px-3 py-2 bg-white rounded-lg text-sm text-amber-700 font-medium">
                  {stock.technicalSignal}
                </div>
              </div>
            )}

            {/* 行业信息 */}
            <div className="bg-slate-50 rounded-xl p-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-700 mb-2 text-sm">
                <Factory className="w-4 h-4" />
                行业信息
              </h3>
              <div className="space-y-1.5">
                <div className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                  <span className="text-slate-500">所属行业</span>
                  <span className="font-medium text-slate-700">{stock.industry || '-'}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                  <span className="text-slate-500">所在地区</span>
                  <span className="font-medium text-slate-700">{stock.region || '-'}</span>
                </div>
                <div className="flex justify-between p-1.5 bg-white rounded-lg text-xs">
                  <span className="text-slate-500">流通市值</span>
                  <span className="font-medium text-slate-700">{stock.marketCap ? `${stock.marketCap.toFixed(2)}亿` : '-'}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
