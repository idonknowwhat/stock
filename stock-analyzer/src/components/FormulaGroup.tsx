import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Star } from 'lucide-react';
import { useState } from 'react';
import type { Stock } from '../types';

interface FormulaGroupProps {
  name: string;
  stocks: Stock[];
  multiFormulaStocks?: Map<string, string[]>;
  defaultExpanded?: boolean;
}

export function FormulaGroup({ name, stocks, multiFormulaStocks, defaultExpanded = true }: FormulaGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const sortedStocks = [...stocks].sort((a, b) => b.change - a.change);
  const avgChange = stocks.length > 0 
    ? stocks.reduce((sum, s) => sum + s.change, 0) / stocks.length 
    : 0;
  const upCount = stocks.filter(s => s.change > 0).length;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between transition-colors"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
          <span className="font-semibold text-slate-800">{name}</span>
          <span className="text-sm text-slate-500">({stocks.length}只)</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className={`font-medium ${avgChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
            均涨幅: {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
          </span>
          <span className="text-slate-500">
            {upCount}涨 / {stocks.length - upCount}跌
          </span>
        </div>
      </button>
      
      {expanded && (
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {sortedStocks.map((stock) => {
            const isMulti = multiFormulaStocks?.has(stock.code);
            return (
              <div 
                key={stock.code}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  isMulti ? 'bg-amber-50 border border-amber-200' : 'bg-white border border-slate-100'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isMulti && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                  <div>
                    <span className="font-medium text-slate-800">{stock.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{stock.code}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1 font-medium ${
                  stock.change > 0 ? 'text-red-600' : stock.change < 0 ? 'text-green-600' : 'text-slate-500'
                }`}>
                  {stock.change > 0 ? <TrendingUp className="w-3 h-3" /> : stock.change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                  {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
