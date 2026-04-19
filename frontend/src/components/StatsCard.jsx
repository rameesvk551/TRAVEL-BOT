// FILE: /frontend/src/components/StatsCard.jsx

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, color = 'brand' }) {
  return (
    <div
      className="relative overflow-hidden rounded-[16px] border border-[#e5e5e5] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.1)]"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#404040] to-[#8a8a8a]" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8a8a8a]">{title}</p>
          <p className="text-3xl font-bold text-[#1a1a1a] mt-1">{value}</p>
          {subtitle && <p className="text-xs text-[#8a8a8a] mt-1">{subtitle}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-2 font-medium ${trend >= 0 ? 'text-[#404040]' : 'text-[#8a8a8a]'}`}>
              {trend >= 0 ? '↗' : '↘'} {Math.abs(trend)}% from last month
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-[#f0f0f0] text-[#404040]">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
