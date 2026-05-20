import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

/**
 * Reusable pagination component matching the Properties/Packages listing style.
 *
 * @param {Object}   props
 * @param {number}   props.currentPage   - Active page (1-indexed)
 * @param {number}   props.totalPages    - Total number of pages
 * @param {number}   props.totalItems    - Total number of items across all pages
 * @param {number}   props.pageSize      - Items per page
 * @param {Function} props.onPageChange  - Called with the new page number
 * @param {string}   [props.itemLabel]   - Label for items, e.g. "leads", "properties" (default: "items")
 */
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = 'items',
}) {
  if (totalItems === 0 || totalPages <= 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  // Build visible page buttons — show up to 5, windowed around currentPage
  const visiblePages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    if (totalPages <= 5) return i + 1;
    if (currentPage <= 3) return i + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + i;
    return currentPage - 2 + i;
  });

  const showEndEllipsis =
    totalPages > 5 && currentPage < totalPages - 2;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
      <p className="text-xs text-neutral-500 font-medium">
        Showing {start} - {end} of {totalItems} {itemLabel}
      </p>

      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="listing-pagination-btn"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`listing-pagination-btn ${
              currentPage === page ? 'listing-pagination-btn-active' : ''
            }`}
          >
            {page}
          </button>
        ))}

        {/* Ellipsis + last page */}
        {showEndEllipsis && (
          <>
            <span className="px-1 text-neutral-400 text-xs">…</span>
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              className="listing-pagination-btn"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* Next */}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="listing-pagination-btn"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
