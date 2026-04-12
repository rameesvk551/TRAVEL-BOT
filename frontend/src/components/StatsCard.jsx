// FILE: /frontend/src/components/StatsCard.jsx

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'brand' }) {
  const colorMap = {
    brand: 'from-brand-500/20 to-brand-600/10 border-brand-500/20',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/20',
    green: 'from-green-500/20 to-green-600/10 border-green-500/20',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/20',
  };

  const iconColorMap = {
    brand: 'text-brand-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${colorMap[color]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-400 font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-surface-400 mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-2 font-medium ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl bg-surface-800/50 ${iconColorMap[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      {/* Decorative gradient circle */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5 blur-xl" />
    </div>
  );
}
