import { useState, useMemo, useEffect } from 'react';
import { Trophy, Star, Award, Medal, Sparkles, CheckSquare, Square, TrendingUp, TrendingDown, Search, X, ArrowUp } from 'lucide-react';
import type { StockRanking } from '../utils/excelParser';
import type { Stock } from '../types';
import { AIAnalysisDialog } from './AIAnalysisDialog';
import { StockDetailDialog } from './StockDetailDialog';

interface StockRankingProps {
  rankings: StockRanking[];
  currentDate: string;       // 当前选中的日期
}

const recommendationConfig = {
  strong: { label: '强烈推荐', color: 'bg-red-100 text-red-700 border-red-200', icon: Trophy },
  medium: { label: '值得关注', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Award },
  weak: { label: '一般', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Medal },
};

export function StockRankingList({ rankings, currentDate }: StockRankingProps) {
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [detailStock, setDetailStock] = useState<Stock | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 模糊搜索过滤
  const filteredRankings = useMemo(() => {
    if (!searchTerm.trim()) return rankings;

    const term = searchTerm.toLowerCase().trim();
    return rankings.filter(item => {
      return item.stock.code.toLowerCase().includes(term) ||
             item.stock.name.toLowerCase().includes(term) ||
             (item.stock.industry && item.stock.industry.toLowerCase().includes(term));
    });
  }, [rankings, searchTerm]);

  // 监听滚动显示回到顶部按钮
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 回到顶部
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSelect = (code: string) => {
    setSelectedStocks(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedStocks.size === filteredRankings.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(filteredRankings.map(r => r.stock.code)));
    }
  };

  const getSelectedStockObjects = () => {
    return rankings.filter(r => selectedStocks.has(r.stock.code)).map(r => r.stock);
  };

  if (rankings.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        暂无排行数据
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索栏 */}
      <div className="flex items-center gap-4 bg-white rounded-xl border border-slate-200 p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索股票代码、名称或行业..."
            className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
        <div className="text-sm text-slate-500">
          {searchTerm ? (
            <span>找到 <strong className="text-blue-600">{filteredRankings.length}</strong> / {rankings.length} 只股票</span>
          ) : (
            <span>共 <strong>{rankings.length}</strong> 只股票</span>
          )}
        </div>
      </div>
      {/* 评分说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-800 mb-2">📊 评分规则说明</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-blue-700">
          <div>
            <span className="font-medium">涨幅得分</span>
            <span className="text-blue-500 ml-1">(0-30分)</span>
          </div>
          <div>
            <span className="font-medium">公式信号</span>
            <span className="text-blue-500 ml-1">(0-40分)</span>
          </div>
          <div>
            <span className="font-medium">换手率</span>
            <span className="text-blue-500 ml-1">(0-15分)</span>
          </div>
          <div>
            <span className="font-medium">振幅</span>
            <span className="text-blue-500 ml-1">(0-15分)</span>
          </div>
        </div>
      </div>

      {/* 前三名特别展示 - 无搜索时显示 */}
      {!searchTerm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {rankings.slice(0, 3).map((item, index) => {
          const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];

          return (
            <div
              key={item.stock.code}
              className={`relative rounded-xl border-2 p-4 ${index === 0 ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300' :
                  index === 1 ? 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-300' :
                    'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200'
                }`}
            >
              <div className="absolute -top-3 -left-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${index === 0 ? 'bg-yellow-400' : index === 1 ? 'bg-slate-300' : 'bg-orange-300'
                  }`}>
                  <Trophy className={`w-5 h-5 ${index === 0 ? 'text-yellow-800' : 'text-white'}`} />
                </div>
              </div>

              <div className="ml-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-slate-800">#{item.rank}</span>
                    <span className={`ml-2 text-lg font-bold ${medalColors[index]}`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-blue-600">{item.score}</div>
                    <div className="text-xs text-slate-500">总分</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="font-semibold text-lg text-slate-800">{item.stock.name}</div>
                  <div className="text-sm text-slate-500">{item.stock.code}</div>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xl font-bold text-slate-800">¥{item.stock.price.toFixed(2)}</span>
                  <span className={`flex items-center gap-1 font-bold ${item.stock.change > 0 ? 'text-red-600' : item.stock.change < 0 ? 'text-green-600' : 'text-slate-600'
                    }`}>
                    {item.stock.change > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {item.stock.change > 0 ? '+' : ''}{item.stock.change.toFixed(2)}%
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {item.formulas.map(f => (
                    <span key={f} className="text-xs px-2 py-0.5 bg-white/70 rounded-full text-slate-600">
                      {f.length > 6 ? f.slice(0, 6) + '..' : f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* 完整排行榜 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-slate-800">
              {searchTerm ? '搜索结果' : '完整排行榜'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* AI 分析全部按钮 */}
            <button
              onClick={() => {
                setSelectedStocks(new Set(filteredRankings.map(r => r.stock.code)));
                setShowAIDialog(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all text-sm shadow-lg shadow-purple-200"
            >
              <Sparkles className="w-4 h-4" />
              AI 分析全部
            </button>
            {selectedStocks.size > 0 && selectedStocks.size < filteredRankings.length && (
              <button
                onClick={() => setShowAIDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all text-sm"
              >
                <Sparkles className="w-4 h-4" />
                分析选中 ({selectedStocks.size})
              </button>
            )}
            <button
              onClick={selectAll}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {selectedStocks.size === filteredRankings.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedStocks.size === filteredRankings.length ? '取消全选' : '全选'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">选择</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">排名</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">股票</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-slate-600">现价</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">涨幅</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">5日</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">20日</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">总分</th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600">趋势</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">信号</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">推荐</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRankings.map((item) => {
                const config = recommendationConfig[item.recommendation];
                const isSelected = selectedStocks.has(item.stock.code);

                return (
                  <tr
                    key={item.stock.code}
                    className={`hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-purple-50' : ''}`}
                    onClick={() => setDetailStock(item.stock)}
                  >
                    <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div
                        className="flex justify-center cursor-pointer"
                        onClick={() => toggleSelect(item.stock.code)}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${item.rank <= 3 ? 'bg-amber-100 text-amber-700' :
                          item.rank <= 10 ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                        }`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.formulaCount > 1 && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        <div>
                          <div className="font-medium text-slate-800">{item.stock.name}</div>
                          <div className="text-xs text-slate-500">{item.stock.code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${item.stock.price >= 100 ? 'text-purple-600' :
                          item.stock.price >= 50 ? 'text-blue-600' :
                            item.stock.price >= 20 ? 'text-slate-700' : 'text-green-700'
                        }`}>
                        ¥{item.stock.price.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`font-medium ${item.stock.change > 0 ? 'text-red-600' :
                          item.stock.change < 0 ? 'text-green-600' : 'text-slate-600'
                        }`}>
                        {item.stock.change > 0 ? '+' : ''}{item.stock.change.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-medium ${(item.stock.change5d || 0) > 5 ? 'text-red-600' :
                          (item.stock.change5d || 0) > 0 ? 'text-orange-500' :
                            (item.stock.change5d || 0) < -5 ? 'text-green-600' : 'text-slate-500'
                        }`}>
                        {item.stock.change5d ? `${item.stock.change5d > 0 ? '+' : ''}${item.stock.change5d.toFixed(1)}%` : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-medium ${(item.stock.change20d || 0) > 10 ? 'text-red-600' :
                          (item.stock.change20d || 0) > 0 ? 'text-orange-500' :
                            (item.stock.change20d || 0) < -10 ? 'text-green-600' : 'text-slate-500'
                        }`}>
                        {item.stock.change20d ? `${item.stock.change20d > 0 ? '+' : ''}${item.stock.change20d.toFixed(1)}%` : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-lg font-bold text-blue-600">{item.score}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-sm font-semibold ${item.scoreDetails.trendScore >= 15 ? 'text-red-600' :
                          item.scoreDetails.trendScore >= 10 ? 'text-orange-500' :
                            item.scoreDetails.trendScore >= 5 ? 'text-blue-500' : 'text-slate-400'
                        }`}>
                        {item.scoreDetails.trendScore}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {item.stock.technicalSignal ? (
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                          {item.stock.technicalSignal}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                        {config.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI 分析对话框 */}
      <AIAnalysisDialog
        isOpen={showAIDialog}
        onClose={() => setShowAIDialog(false)}
        stocks={getSelectedStockObjects()}
        currentDate={currentDate}
      />

      {/* 股票详情对话框 */}
      <StockDetailDialog
        isOpen={detailStock !== null}
        onClose={() => setDetailStock(null)}
        stock={detailStock}
      />

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all z-40 animate-fade-in"
          title="回到顶部"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
