import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { displayText } from '../utils/displayText';

const CHART_PRIMARY = '#6366f1';
const CHART_SECONDARY = '#a78bfa';
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#a3a3a3', '#404040'];

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-400">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {displayText(p.name)}: {formatter ? formatter(p.value) : displayText(p.value, 0)}
        </p>
      ))}
    </div>
  );
}

export function ChartFallback({ text = 'Loading chart...' }) {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-neutral-400">
      {text}
    </div>
  );
}

export function RevenueTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.15} />
            <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#a3a3a3' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `Rs ${(v / 1000).toFixed(0)}K` : `Rs ${v}`)}
        />
        <Tooltip content={<ChartTooltip formatter={(v) => `Rs ${v.toLocaleString('en-IN')}`} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke={CHART_PRIMARY}
          strokeWidth={2.5}
          fill="url(#dashRevGrad)"
          name="Revenue"
          dot={false}
          activeDot={{ r: 5, fill: CHART_PRIMARY, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LeadStatusDonut({ data }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="w-full sm:w-1/2">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={52}
              dataKey="value"
              nameKey="name"
              paddingAngle={3}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e5e5e5',
                fontSize: '12px',
                boxShadow: '0 8px 24px -8px rgba(0,0,0,0.08)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-2 sm:w-1/2">
        {data.map((d, i) => {
          const name = displayText(d.name, 'Unknown');
          return (
          <div key={i} className="flex items-center justify-between rounded-[var(--radius-sm)] bg-neutral-50 px-3 py-2 transition hover:bg-neutral-100">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="text-[13px] text-neutral-600 capitalize">{name.toLowerCase()}</span>
            </div>
            <span className="text-[13px] font-bold text-neutral-900">{displayText(d.value, 0)}</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function LeadsOverTimeChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="dashLeadGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART_SECONDARY} stopOpacity={0.15} />
            <stop offset="95%" stopColor={CHART_SECONDARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#a3a3a3' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="leads"
          stroke={CHART_SECONDARY}
          strokeWidth={2.5}
          fill="url(#dashLeadGrad)"
          name="Leads"
          dot={false}
          activeDot={{ r: 5, fill: CHART_SECONDARY, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
