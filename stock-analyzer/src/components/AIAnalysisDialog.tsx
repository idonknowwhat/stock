import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, AlertCircle, MessageSquare, FileText, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Stock } from '../types';
import { loadSettings } from './SettingsDialog';
import { getStocksHistory, type DailyRecord } from '../db/index';

interface AIAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stocks: Stock[];
  currentDate: string;      // 当前选中的日期
}

type AnalysisMode = 'batch' | 'chat';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 格式化单只股票的历史数据为文本
function formatStockHistoryFromDB(records: DailyRecord[]): string {
  if (records.length === 0) return '无历史记录';

  return records.map(r =>
    `  - ${r.date}: 价格¥${r.price.toFixed(2)}, 涨幅${r.change >= 0 ? '+' : ''}${r.change.toFixed(2)}%, 公式[${r.formulas.join(', ')}]`
  ).join('\n');
}

// 生成系统提示词 - 让AI扮演专业股票分析师
function generateSystemPrompt(
  stocks: Stock[],
  historyMap: Map<string, DailyRecord[]>,
  currentDate: string
): string {
  // 生成股票列表（包含历史数据）
  const stockListWithHistory = stocks.map(s => {
    const history = historyMap.get(s.code) || [];
    const historyText = history.length > 0 ? `\n  历史选中记录:\n${formatStockHistoryFromDB(history)}` : '';

    return `- ${s.name}(${s.code}): 现价¥${s.price.toFixed(2)}, 涨跌幅${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%, 换手率${s.turnover.toFixed(2)}%, 振幅${s.amplitude.toFixed(2)}%, 行业: ${s.industry || '未知'}${historyText}`;
  }).join('\n');

  return `你是一位资深的A股股票分析师，拥有10年以上的投资经验。你精通技术分析、基本面分析和行业研究。

## 核心前提（非常重要）
用户正在使用**选股公式**筛选潜力股票，这些股票是公式自动选出的候选标的，**用户目前并未持有这些股票**。
你的任务是帮助用户判断：**这些股票是否值得买入？**

## 你的专业能力包括：
- 深入的技术面分析（K线形态、均线系统、量价关系、技术指标）
- 全面的基本面研究（财务分析、估值模型、行业研究）
- 敏锐的市场洞察（政策解读、资金流向、市场情绪）
- 严谨的风险管理（仓位控制、止损策略、风险评估）

## 当前研究池中的股票（${currentDate}）：
${stockListWithHistory}

## 重要：历史数据说明
如果某只股票有"历史选中记录"，说明该股票在之前的日期也被选股公式选中过。
请特别关注：
1. 股票价格的变化趋势（是上涨还是下跌？）
2. 如果之前出现过，当时的价格是多少？现在是更贵还是更便宜？
3. 反复被选中可能说明该股持续符合某些技术条件

## 你的工作方式：
- 用专业但易懂的语言回答问题
- 给出具体的数据支撑和逻辑推理
- 提供明确的**买入建议**（强烈建议买入/可考虑买入/暂时观望/不建议买入）
- 如果历史上曾分析过该股票，要对比前后变化给出一致性评估
- 坦诚说明不确定性，不夸大收益
- 根据用户问题灵活调整分析深度

请始终保持专业、客观、负责的态度，帮助投资者做出理性的决策。`;
}

// 生成批量分析提示词
function generateBatchPrompt(
  stocks: Stock[],
  historyMap: Map<string, DailyRecord[]>,
  currentDate: string
): string {
  // 统计有历史记录的股票
  const stocksWithHistory: { stock: Stock; history: DailyRecord[] }[] = [];
  const stocksWithoutHistory: Stock[] = [];

  for (const stock of stocks) {
    const history = historyMap.get(stock.code) || [];
    if (history.length > 0) {
      stocksWithHistory.push({ stock, history });
    } else {
      stocksWithoutHistory.push(stock);
    }
  }

  // 生成股票列表
  let stockListText = '';

  // 先列出有历史记录的股票（重点关注）
  if (stocksWithHistory.length > 0) {
    stockListText += '### 【重复出现的股票 - 需重点对比分析】\n';
    stockListText += stocksWithHistory.map(({ stock: s, history }) => {
      const historyText = formatStockHistoryFromDB(history);
      const priceChange = history.length > 0 ?
        ((s.price - history[0].price) / history[0].price * 100).toFixed(2) : '0';

      return `- **${s.name}(${s.code})** [距首次选中${priceChange}%]
  今日数据(${currentDate}): 现价¥${s.price.toFixed(2)}, 涨幅${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%, 换手率${s.turnover.toFixed(2)}%, 行业: ${s.industry || '未知'}
  历史记录:
${historyText}`;
    }).join('\n\n');
    stockListText += '\n\n';
  }

  // 再列出无历史记录的股票
  if (stocksWithoutHistory.length > 0) {
    stockListText += '### 【首次出现的股票】\n';
    stockListText += stocksWithoutHistory.map(s =>
      `- ${s.name}(${s.code}): 现价¥${s.price.toFixed(2)}, 涨幅${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%, 换手率${s.turnover.toFixed(2)}%, 振幅${s.amplitude.toFixed(2)}%, 行业: ${s.industry || '未知'}`
    ).join('\n');
  }

  return `请对以下${stocks.length}只由选股公式筛选出的股票进行深度分析。

## 核心前提
这些股票是用户通过**选股公式**自动筛选出来的潜力标的，**用户目前并未持有任何一只**。
你的任务是帮助用户判断：**哪些股票值得买入？哪些应该放弃？**

## 今日数据日期：${currentDate}

## 待分析股票列表
${stockListText}

## 分析要求

### 1. 历史对比分析（如有历史记录）
- 对于重复出现的股票，**必须**对比历史数据：
  - 价格走势：比首次选中时是涨是跌？幅度多少？
  - 如果价格已大涨，是否存在追高风险？
  - 如果价格下跌，是抄底机会还是趋势走坏？
  - 多次被选中是信号加强还是应该警惕？

### 2. 个股技术面分析
- 根据涨跌幅、换手率、振幅判断当前走势强弱
- 换手率过高(>15%)可能有主力出货风险，过低(<1%)可能流动性不足
- 振幅大说明波动剧烈，需注意风险

### 3. 行业分析
- 分析每只股票所属行业的当前景气度
- 该行业是否有政策利好或利空
- 行业内是否有龙头效应或板块轮动机会

### 4. 买入建议（核心输出）
针对每只股票给出明确建议：
- **强烈建议买入**：技术面、基本面俱佳，风险可控
- **可考虑买入**：整体看好，但需注意某些风险
- **暂时观望**：信号不够明确，建议继续观察
- **不建议买入**：风险大于收益，或已错过最佳时机

### 5. 综合排序
- 按买入价值从高到低排序
- 标注风险等级（低/中/高）
- 如有建仓建议，给出参考仓位

### 6. 风险提示
- 列出主要风险点
- 特别标注追高风险、流动性风险等

请用简洁专业的语言回答，重点突出，给出可执行的建议。`;
}

export function AIAnalysisDialog({ isOpen, onClose, stocks, currentDate }: AIAnalysisDialogProps) {
  const [mode, setMode] = useState<AnalysisMode>('batch');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');

  // 从数据库加载历史数据
  const [historyMap, setHistoryMap] = useState<Map<string, DailyRecord[]>>(new Map());
  const [historyLoading, setHistoryLoading] = useState(false);

  // 当股票列表变化时，从数据库加载历史数据
  useEffect(() => {
    if (!isOpen || stocks.length === 0) {
      setHistoryMap(new Map());
      return;
    }

    setHistoryLoading(true);
    const codes = stocks.map(s => s.code);

    getStocksHistory(codes)
      .then(result => {
        // 过滤掉当前日期的数据（只保留历史）
        const filtered = new Map<string, DailyRecord[]>();
        for (const [code, records] of result) {
          const historyRecords = records.filter(r => r.date !== currentDate);
          if (historyRecords.length > 0) {
            filtered.set(code, historyRecords);
          }
        }
        setHistoryMap(filtered);
      })
      .finally(() => setHistoryLoading(false));
  }, [isOpen, stocks, currentDate]);

  // 批量分析模式
  const startBatchAnalysis = async () => {
    const settings = loadSettings();

    if (!settings.apiKey || !settings.selectedModel) {
      setError('请先在设置中配置 API Key 和选择模型');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setResult('');

    try {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [
            { role: 'user', content: generateBatchPrompt(stocks, historyMap, currentDate) }
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '未获取到分析结果';
      setResult(content);
    } catch (e) {
      setError(`分析失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 对话模式 - 发送消息
  const sendChatMessage = async (content: string) => {
    const settings = loadSettings();

    if (!settings.apiKey || !settings.selectedModel) {
      setError('请先在设置中配置 API Key 和选择模型');
      return;
    }

    if (!content.trim()) return;

    const userMessage: Message = { role: 'user', content: content.trim() };
    const newMessages = messages.length === 0
      ? [
          { role: 'system' as const, content: generateSystemPrompt(stocks, historyMap, currentDate) },
          userMessage
        ]
      : [...messages, userMessage];

    setMessages(newMessages);
    setUserInput('');
    setIsAnalyzing(true);
    setError('');

    try {
      const response = await fetch(`${settings.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: newMessages,
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const assistantContent = data.choices?.[0]?.message?.content || '未获取到回复';
      const assistantMessage: Message = { role: 'assistant', content: assistantContent };

      setMessages([...newMessages, assistantMessage]);
    } catch (e) {
      setError(`发送失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 重置对话
  const resetChat = () => {
    setMessages([]);
    setUserInput('');
    setError('');
  };

  // 切换模式时重置状态
  const handleModeChange = (newMode: AnalysisMode) => {
    setMode(newMode);
    setResult('');
    setError('');
    setMessages([]);
    setUserInput('');
  };

  if (!isOpen) return null;

  // 统计有历史记录的股票数量
  const stocksWithHistoryCount = stocks.filter(s => historyMap.has(s.code)).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-slate-800">AI 股票分析师</h2>
            <span className="text-sm text-slate-500">({stocks.length}只股票)</span>
            {stocksWithHistoryCount > 0 && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                {stocksWithHistoryCount}只有历史记录
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 模式切换器 */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => handleModeChange('batch')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                mode === 'batch'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              批量分析
            </button>
            <button
              onClick={() => handleModeChange('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                mode === 'chat'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              对话模式
            </button>
          </div>
        </div>

        {/* 股票列表预览 */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex flex-wrap gap-2">
            {stocks.slice(0, 8).map(stock => (
              <div
                key={stock.code}
                className={`flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border ${
                  historyMap.has(stock.code) ? 'border-amber-300' : 'border-slate-200'
                }`}
              >
                <span className="font-medium text-slate-800 text-sm">{stock.name}</span>
                <span className="text-xs text-slate-500">{stock.code}</span>
                <span className={`text-xs font-medium ${
                  stock.change > 0 ? 'text-red-600' : stock.change < 0 ? 'text-green-600' : 'text-slate-600'
                }`}>
                  {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                </span>
                {historyMap.has(stock.code) && (
                  <span className="text-xs text-amber-600">({historyMap.get(stock.code)!.length}天)</span>
                )}
              </div>
            ))}
            {stocks.length > 8 && (
              <div className="flex items-center px-3 py-1.5 bg-slate-100 rounded-lg text-sm text-slate-600">
                +{stocks.length - 8}只
              </div>
            )}
          </div>
        </div>

        {/* 历史数据加载状态 */}
        {historyLoading && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-700 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            正在从数据库加载历史数据...
          </div>
        )}

        {/* 批量分析模式 */}
        {mode === 'batch' && (
          <div className="flex-1 overflow-auto p-6">
            {!isAnalyzing && !result && !error && (
              <div className="text-center py-12">
                <Sparkles className="w-16 h-16 text-purple-200 mx-auto mb-4" />
                <p className="text-slate-600 mb-2 font-medium">一键深度分析</p>
                <p className="text-sm text-slate-500 mb-6">
                  AI将从技术面、行业、估值、风险等多维度分析所选股票
                  {stocksWithHistoryCount > 0 && (
                    <span className="block mt-1 text-amber-600">
                      其中 {stocksWithHistoryCount} 只股票有历史数据，将进行对比分析
                    </span>
                  )}
                </p>
                <button
                  onClick={startBatchAnalysis}
                  disabled={historyLoading}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    开始分析
                  </span>
                </button>
              </div>
            )}

            {isAnalyzing && (
              <div className="text-center py-12">
                <Loader2 className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-spin" />
                <p className="text-slate-600">AI 正在分析中，请稍候...</p>
                <p className="text-sm text-slate-400 mt-2">分析可能需要 10-30 秒</p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-300 mx-auto mb-4" />
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={startBatchAnalysis}
                  className="px-6 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  重试
                </button>
              </div>
            )}

            {result && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6 border border-purple-100">
                <h3 className="flex items-center gap-2 text-purple-800 mt-0 mb-4">
                  <Sparkles className="w-5 h-5" />
                  AI 分析报告
                </h3>
                <div className="prose prose-slate max-w-none prose-headings:text-purple-900 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-strong:text-purple-700 prose-li:my-1">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 对话模式 */}
        {mode === 'chat' && (
          <>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {messages.length === 0 && !error && (
                <div className="text-center py-12">
                  <MessageSquare className="w-16 h-16 text-purple-200 mx-auto mb-4" />
                  <p className="text-slate-600 mb-2 font-medium">与AI分析师对话</p>
                  <p className="text-sm text-slate-500 mb-4">
                    我是您的专属股票分析师，可以回答关于这些股票的任何问题
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                    <button
                      onClick={() => sendChatMessage('请帮我分析一下这些股票的整体情况')}
                      disabled={historyLoading}
                      className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm disabled:opacity-50"
                    >
                      整体情况分析
                    </button>
                    <button
                      onClick={() => sendChatMessage('哪只股票最值得买入？')}
                      disabled={historyLoading}
                      className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm disabled:opacity-50"
                    >
                      推荐最优股票
                    </button>
                    <button
                      onClick={() => sendChatMessage('这些股票的行业分布如何？')}
                      disabled={historyLoading}
                      className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors text-sm disabled:opacity-50"
                    >
                      行业分析
                    </button>
                  </div>
                </div>
              )}

              {messages.filter(m => m.role !== 'system').map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-slate max-w-none prose-p:my-2 prose-headings:my-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {isAnalyzing && (
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
            </div>

            {/* 对话输入框 */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
              <div className="flex gap-3">
                {messages.length > 0 && (
                  <button
                    onClick={resetChat}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm"
                  >
                    重置对话
                  </button>
                )}
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendChatMessage(userInput);
                      }
                    }}
                    placeholder="输入您的问题，例如：这些股票中哪个风险最低？"
                    disabled={isAnalyzing || historyLoading}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none disabled:bg-slate-100"
                  />
                  <button
                    onClick={() => sendChatMessage(userInput)}
                    disabled={isAnalyzing || !userInput.trim() || historyLoading}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 批量分析模式的底部按钮 */}
        {mode === 'batch' && result && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
            <button
              onClick={() => { setResult(''); setError(''); }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              重新分析
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
