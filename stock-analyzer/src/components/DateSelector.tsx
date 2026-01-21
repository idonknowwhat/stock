import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, X, Search, Clock } from 'lucide-react';
import type { DateMeta } from '../db/index';

interface DateSelectorProps {
  dates: DateMeta[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onRemoveDate: (date: string) => void;
}

export function DateSelector({ dates, selectedDate, onSelectDate, onRemoveDate }: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 过滤日期
  const filteredDates = dates.filter(d =>
    d.date.includes(searchTerm) ||
    searchTerm === ''
  );

  // 获取当前选中日期的元数据
  const selectedDateMeta = dates.find(d => d.date === selectedDate);

  // 最近5个日期（快速访问）
  const recentDates = dates.slice(0, 5);

  if (dates.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* 快速访问：最近5个日期 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          最近:
        </span>
        {recentDates.map(dateMeta => (
          <button
            key={dateMeta.date}
            onClick={() => onSelectDate(dateMeta.date)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              selectedDate === dateMeta.date
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            {dateMeta.date}
            <span className="ml-1 opacity-70">({dateMeta.stockCount})</span>
          </button>
        ))}

        {/* 更多日期下拉 */}
        {dates.length > 5 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-600 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              更多 ({dates.length - 5})
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                {/* 搜索框 */}
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="搜索日期..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 日期列表 */}
                <div className="max-h-64 overflow-auto">
                  {filteredDates.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">
                      没有找到匹配的日期
                    </div>
                  ) : (
                    filteredDates.map(dateMeta => (
                      <div
                        key={dateMeta.date}
                        className={`flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer ${
                          selectedDate === dateMeta.date ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => {
                          onSelectDate(dateMeta.date);
                          setIsOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className={`w-4 h-4 ${
                            selectedDate === dateMeta.date ? 'text-blue-600' : 'text-slate-400'
                          }`} />
                          <div>
                            <div className={`text-sm font-medium ${
                              selectedDate === dateMeta.date ? 'text-blue-600' : 'text-slate-700'
                            }`}>
                              {dateMeta.date}
                            </div>
                            <div className="text-xs text-slate-500">
                              {dateMeta.stockCount} 只股票 · {dateMeta.formulaCount} 个公式
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveDate(dateMeta.date);
                          }}
                          className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* 统计信息 */}
                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  共 {dates.length} 个日期，
                  {dates.reduce((sum, d) => sum + d.stockCount, 0)} 条记录
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 当前选中日期详情 */}
      {selectedDateMeta && (
        <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl px-4 py-2 border border-blue-100">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-600" />
            <div>
              <span className="font-semibold text-blue-800">{selectedDateMeta.date}</span>
              <span className="mx-2 text-blue-300">|</span>
              <span className="text-blue-700">{selectedDateMeta.stockCount} 只股票</span>
              <span className="mx-2 text-blue-300">|</span>
              <span className="text-blue-600 text-sm">{selectedDateMeta.formulas.join(', ')}</span>
            </div>
          </div>
          <button
            onClick={() => onRemoveDate(selectedDateMeta.date)}
            className="p-1.5 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
            title="删除此日期数据"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
