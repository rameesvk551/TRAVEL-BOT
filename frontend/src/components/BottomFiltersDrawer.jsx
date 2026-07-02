import { FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * Reusable bottom-sheet filter drawer for listing pages (Properties, Packages, etc.).
 * Props:
 *  - open / onClose
 *  - tabs: [{ key, label }] — the filter tab options
 *  - activeTab / onTabChange
 *  - sortOptions: [{ key, label }] — sort dropdown options
 *  - sortBy / onSortChange
 *  - extraFilters (optional) — additional filter dropdowns [{label, value, onChange, options: [{key, label}]}]
 */
export default function BottomFiltersDrawer({
  open, onClose,
  tabs, activeTab, onTabChange,
  sortOptions, sortBy, onSortChange,
  extraFilters,
}) {
  if (!open) return null;

  const handleReset = () => {
    if (onTabChange) onTabChange(tabs?.[0]?.key || 'ALL');
    if (onSortChange) onSortChange(sortOptions?.[0]?.key || 'newest');
    if (extraFilters) extraFilters.forEach((f) => f.onChange(f.options?.[0]?.key || 'ALL'));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:hidden">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full rounded-t-3xl bg-white shadow-2xl animate-drawer-up">
        <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-neutral-200" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-neutral-900">
              <FunnelIcon className="h-4 w-4 text-neutral-500" /> Filters
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Close filters"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="border-t border-neutral-100 px-5 py-4 space-y-5">
          {/* Status / Category tabs */}
          {tabs && tabs.length > 0 && (
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={`rounded-lg px-3.5 py-2 text-xs font-semibold border transition ${
                      activeTab === tab.key
                        ? 'bg-neutral-900 border-neutral-900 text-white'
                        : 'bg-white border-neutral-200 text-neutral-600'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort */}
          {sortOptions && sortOptions.length > 0 && (
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm font-medium text-neutral-700 outline-none focus:border-neutral-400"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Extra filters */}
          {extraFilters && extraFilters.map((filter, idx) => (
            <div key={idx}>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                {filter.label}
              </label>
              <select
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm font-medium text-neutral-700 outline-none focus:border-neutral-400"
              >
                {filter.options.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-xl border border-neutral-200 bg-white py-2.5 text-sm font-semibold text-neutral-700"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-neutral-900 py-2.5 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
