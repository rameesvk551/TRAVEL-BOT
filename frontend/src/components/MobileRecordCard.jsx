export function MobileField({ label, value, children }) {
  return (
    <div className="min-w-0">
      <p className="mobile-field-label">{label}</p>
      <div className="mobile-field-value">{children || value || <span className="text-neutral-300">-</span>}</div>
    </div>
  );
}

export default function MobileRecordCard({ title, subtitle, avatar, badge, children, actions, onClick }) {
  const Component = onClick ? 'button' : 'article';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`mobile-record-card w-full text-left ${onClick ? 'transition active:scale-[0.99]' : ''}`}
    >
      <div className="flex items-start gap-3">
        {avatar ? <div className="shrink-0">{avatar}</div> : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold leading-tight text-neutral-900">{title}</h3>
          {subtitle ? <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>

      {children ? <div className="mobile-field-grid">{children}</div> : null}

      {actions ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </Component>
  );
}
