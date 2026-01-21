import { TrendingUp, TrendingDown, BarChart3, Users } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  type?: 'up' | 'down' | 'neutral' | 'info';
  icon?: 'trending-up' | 'trending-down' | 'chart' | 'users';
}

const iconMap = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'chart': BarChart3,
  'users': Users,
};

const colorMap = {
  up: 'bg-red-50 text-red-600 border-red-200',
  down: 'bg-green-50 text-green-600 border-green-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
  info: 'bg-blue-50 text-blue-600 border-blue-200',
};

export function StatsCard({ title, value, subtitle, type = 'neutral', icon }: StatsCardProps) {
  const Icon = icon ? iconMap[icon] : null;
  
  return (
    <div className={`rounded-xl border p-4 ${colorMap[type]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
        </div>
        {Icon && <Icon className="w-8 h-8 opacity-50" />}
      </div>
    </div>
  );
}
