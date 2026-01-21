import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Stock, StockGroup } from '../types';

interface FormulaChartProps {
  groups: StockGroup[];
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];

export function FormulaPerformanceChart({ groups }: FormulaChartProps) {
  const data = groups.map((group, index) => {
    const avgChange = group.stocks.length > 0
      ? group.stocks.reduce((sum, s) => sum + s.change, 0) / group.stocks.length
      : 0;
    return {
      name: group.name.length > 8 ? group.name.slice(0, 8) + '...' : group.name,
      fullName: group.name,
      avgChange: parseFloat(avgChange.toFixed(2)),
      count: group.stocks.length,
      color: COLORS[index % COLORS.length],
    };
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">各公式平均涨幅</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12, fill: '#64748b' }}
            angle={-45}
            textAnchor="end"
            interval={0}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}%`, '平均涨幅']}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Bar 
            dataKey="avgChange" 
            radius={[4, 4, 0, 0]}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.avgChange >= 0 ? '#ef4444' : '#22c55e'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface IndustryChartProps {
  stocks: Stock[];
}

export function IndustryDistributionChart({ stocks }: IndustryChartProps) {
  const industryMap = new Map<string, number>();
  stocks.forEach(stock => {
    const industry = stock.industry || '未知';
    industryMap.set(industry, (industryMap.get(industry) || 0) + 1);
  });

  const data = Array.from(industryMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8); // 只取前8个

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">行业分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="count"
            nameKey="name"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => [`${value}只`, '数量']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ChangeDistributionProps {
  stocks: Stock[];
}

export function ChangeDistributionChart({ stocks }: ChangeDistributionProps) {
  // 按涨跌幅区间分组
  const ranges = [
    { label: '>5%', min: 5, max: Infinity },
    { label: '3~5%', min: 3, max: 5 },
    { label: '1~3%', min: 1, max: 3 },
    { label: '0~1%', min: 0, max: 1 },
    { label: '-1~0%', min: -1, max: 0 },
    { label: '-3~-1%', min: -3, max: -1 },
    { label: '<-3%', min: -Infinity, max: -3 },
  ];

  const data = ranges.map(range => ({
    name: range.label,
    count: stocks.filter(s => s.change >= range.min && s.change < range.max).length,
    color: range.min >= 0 ? '#ef4444' : '#22c55e',
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="text-lg font-semibold text-slate-800 mb-4">涨跌幅分布</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 50, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis 
            dataKey="name" 
            type="category" 
            tick={{ fontSize: 12, fill: '#64748b' }}
            width={60}
          />
          <Tooltip 
            formatter={(value: number) => [`${value}只`, '数量']}
            contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
