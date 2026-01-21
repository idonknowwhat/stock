import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Star, TrendingUp, TrendingDown, Search, X } from 'lucide-react';
import type { Stock } from '../types';

interface StockTableProps {
  stocks: Stock[];
  multiFormulaStocks?: Map<string, string[]>;
  title?: string;
  showRank?: boolean;
}

type SortKey = 'change' | 'price' | 'volume' | 'turnover' | 'pe' | 'marketCap';
type SortOrder = 'asc' | 'desc';

// 可排序表头组件 - 移到组件外部
function SortableHeader({ 
  label, 
  sortKey: currentSortKey, 
  sortOrder, 
  targetKey, 
  onSort 
}: { 
  label: string; 
  sortKey: SortKey; 
  sortOrder: SortOrder; 
  targetKey: SortKey; 
  onSort: (key: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(targetKey)}
      className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 select-none"
    >
      <div className="flex items-center gap-1">
        {label}
        {currentSortKey === targetKey ? (
          sortOrder === 'desc' ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-slate-400" />
        )}
      </div>
    </th>
  );
}

// 格式化涨跌幅
function formatChange(change: number) {
  const color = change > 0 ? 'text-red-600' : change < 0 ? 'text-green-600' : 'text-slate-500';
  const icon = change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null;
  return (
    <span className={`flex items-center gap-1 font-medium ${color}`}>
      {icon}
      {change > 0 ? '+' : ''}{change.toFixed(2)}%
    </span>
  );
}

export function StockTable({ stocks, multiFormulaStocks, title, showRank = false }: StockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('change');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  // 模糊搜索过滤
  const filteredStocks = useMemo(() => {
    if (!searchTerm.trim()) return stocks;

    const term = searchTerm.toLowerCase().trim();
    return stocks.filter(stock => {
      // 支持代码和名称的模糊匹配
      return stock.code.toLowerCase().includes(term) ||
             stock.name.toLowerCase().includes(term) ||
             (stock.industry && stock.industry.toLowerCase().includes(term));
    });
  }, [stocks, searchTerm]);

  const sortedStocks = useMemo(() => {
    return [...filteredStocks].sort((a, b) => {
      const aVal = a[sortKey] || 0;
      const bVal = b[sortKey] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [filteredStocks, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  if (stocks.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        暂无数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        {title && (
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            {title}
            <span className="text-sm font-normal text-slate-500">
              ({filteredStocks.length}{filteredStocks.length !== stocks.length ? `/${stocks.length}` : ''}只)
            </span>
          </h3>
        )}
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索代码/名称/行业..."
            className="pl-9 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none w-52"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {showRank && <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600">#</th>}
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">代码</th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">名称</th>
            <SortableHeader label="涨跌幅" sortKey={sortKey} sortOrder={sortOrder} targetKey="change" onSort={handleSort} />
            <SortableHeader label="现价" sortKey={sortKey} sortOrder={sortOrder} targetKey="price" onSort={handleSort} />
            <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">行业</th>
            <SortableHeader label="换手率" sortKey={sortKey} sortOrder={sortOrder} targetKey="turnover" onSort={handleSort} />
            <SortableHeader label="市盈率" sortKey={sortKey} sortOrder={sortOrder} targetKey="pe" onSort={handleSort} />
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {sortedStocks.map((stock, index) => {
            const isMultiFormula = multiFormulaStocks?.has(stock.code);
            const formulas = multiFormulaStocks?.get(stock.code);
            
            return (
              <tr 
                key={stock.code} 
                className={`hover:bg-slate-50 transition-colors ${isMultiFormula ? 'bg-amber-50' : ''}`}
              >
                {showRank && (
                  <td className="px-3 py-3 text-sm text-slate-500">{index + 1}</td>
                )}
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-sm font-mono text-slate-600">{stock.code}</span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {isMultiFormula && (
                      <span title={`多重信号: ${formulas?.join(' + ')}`}>
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-900">{stock.name}</span>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {formatChange(stock.change)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-700">
                  {stock.price.toFixed(2)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                    {stock.industry || '-'}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
                  {stock.turnover.toFixed(2)}%
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-sm text-slate-600">
                  {stock.pe > 0 ? stock.pe.toFixed(2) : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
