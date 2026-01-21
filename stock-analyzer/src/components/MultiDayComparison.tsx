import { Star, Calendar, Flame } from 'lucide-react';
import type { DayData } from '../types';
import { findRepeatedStocks } from '../utils/excelParser';

interface MultiDayComparisonProps {
  dayDataList: DayData[];
}

export function MultiDayComparison({ dayDataList }: MultiDayComparisonProps) {
  if (dayDataList.length < 2) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <Calendar className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-amber-800 font-medium">请上传至少2天的数据进行对比</p>
        <p className="text-amber-600 text-sm mt-1">可同时选择多个Excel文件上传</p>
      </div>
    );
  }

  const repeatedStocks = findRepeatedStocks(dayDataList);
  
  // 筛选出连续出现的股票
  const continuousStocks = Array.from(repeatedStocks.entries())
    .filter(([_, data]) => data.dates.length >= 2)
    .map(([code, data]) => ({
      code,
      ...data,
      formulaCount: data.formulas.size,
      totalChange: data.changes.reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.dates.length - a.dates.length || b.formulaCount - a.formulaCount);

  // 日期列表（排序）
  const sortedDates = [...new Set(dayDataList.map(d => d.date))].sort();

  return (
    <div className="space-y-6">
      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Flame className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-amber-700">连续上榜股票</p>
              <p className="text-2xl font-bold text-amber-800">{continuousStocks.length}只</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-700">对比天数</p>
              <p className="text-2xl font-bold text-blue-800">{sortedDates.length}天</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Star className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-purple-700">最多出现</p>
              <p className="text-2xl font-bold text-purple-800">
                {continuousStocks[0]?.dates.length || 0}天
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 连续上榜列表 */}
      {continuousStocks.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
            <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
              <Flame className="w-5 h-5" />
              连续上榜股票 - 潜力追踪
            </h3>
            <p className="text-sm text-amber-600 mt-1">这些股票在多天中被公式反复选中，值得重点关注</p>
          </div>
          <div className="divide-y divide-slate-100">
            {continuousStocks.map(({ code, stock, dates, formulas, changes, totalChange }) => (
              <div key={code} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                      dates.length >= 3 ? 'bg-red-100 text-red-700' :
                      dates.length >= 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {dates.length}天
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800">{stock.name}</span>
                        <span className="text-sm text-slate-400">{code}</span>
                        {formulas.size > 1 && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <Star className="w-3 h-3" />
                            {formulas.size}个公式
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Array.from(formulas).map(formula => (
                          <span key={formula} className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {formula}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        出现日期: {dates.join(', ')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      totalChange > 0 ? 'text-red-600' : totalChange < 0 ? 'text-green-600' : 'text-slate-600'
                    }`}>
                      {totalChange > 0 ? '+' : ''}{totalChange.toFixed(2)}%
                    </div>
                    <div className="text-xs text-slate-500">累计涨跌</div>
                    <div className="flex items-center gap-1 mt-1">
                      {changes.map((change, i) => (
                        <span 
                          key={i}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            change > 0 ? 'bg-red-100 text-red-600' : 
                            change < 0 ? 'bg-green-100 text-green-600' : 
                            'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {change > 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 每日对比表格 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">每日数据对比</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">股票数</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">上涨/下跌</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">平均涨幅</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">大盘</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dayDataList
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(dayData => {
                  const upCount = dayData.allStocks.filter(s => s.change > 0).length;
                  const downCount = dayData.allStocks.filter(s => s.change < 0).length;
                  const avgChange = dayData.allStocks.length > 0
                    ? dayData.allStocks.reduce((sum, s) => sum + s.change, 0) / dayData.allStocks.length
                    : 0;
                  
                  return (
                    <tr key={dayData.date} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{dayData.date}</td>
                      <td className="px-4 py-3 text-slate-600">{dayData.allStocks.length}只</td>
                      <td className="px-4 py-3">
                        <span className="text-red-600">{upCount}涨</span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-green-600">{downCount}跌</span>
                      </td>
                      <td className={`px-4 py-3 font-medium ${
                        avgChange > 0 ? 'text-red-600' : avgChange < 0 ? 'text-green-600' : 'text-slate-600'
                      }`}>
                        {avgChange > 0 ? '+' : ''}{avgChange.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3">
                        {dayData.index ? (
                          <span className={dayData.index.change >= 0 ? 'text-red-600' : 'text-green-600'}>
                            {dayData.index.change >= 0 ? '+' : ''}{dayData.index.change.toFixed(2)}%
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
