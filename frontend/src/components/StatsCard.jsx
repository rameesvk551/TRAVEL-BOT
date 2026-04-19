// FILE: /frontend/src/components/StatsCard.jsx

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, iconBg = 'bg-indigo-50', iconColor = 'text-indigo-600' }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">{title}</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-neutral-500 mt-1.5">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-2 font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        {Icon && (
          <div className={`kpi-icon ${iconBg} ${iconColor}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
