import { Icon, type IconName } from '../atoms/Icon';

type MetricVariant = 'default' | 'warning' | 'danger';
type MetricTrend = 'up' | 'down';

interface MetricCardProps {
  icon: IconName;
  label: string;
  value: string | number;
  trend?: MetricTrend | null;
  variant?: MetricVariant;
}

const variantStyles: Record<MetricVariant, string> = {
  default: 'border-slate-200',
  warning: 'border-amber-300 bg-amber-50',
  danger: 'border-red-300 bg-red-50',
};

const trendColors: Record<MetricTrend, string> = {
  up: 'text-emerald-600',
  down: 'text-red-600',
};

export function MetricCard({
  icon,
  label,
  value,
  trend = null,
  variant = 'default',
}: MetricCardProps) {
  return (
    <div
      className={`flex items-start gap-4 rounded-xl border bg-white p-5 shadow-sm ${variantStyles[variant]}`}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon name={icon} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-500">{label}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          {trend && (
            <span
              className={`text-sm font-medium ${trendColors[trend]}`}
            >
              {trend === 'up' ? '↑' : '↓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
