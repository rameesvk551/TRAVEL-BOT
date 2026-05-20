import { Link } from 'react-router-dom';
import { ChevronLeftIcon, MegaphoneIcon } from '@heroicons/react/24/outline';

export default function CreateAd() {
  return (
    <div className="mx-auto max-w-4xl px-3 py-8 sm:px-6">
      <Link to="/ads" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-900">
        <ChevronLeftIcon className="h-4 w-4" />
        Back to Social Ads
      </Link>

      <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
          <MegaphoneIcon className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-neutral-900">Ad creation is outside v1</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
          This release focuses on retrieving Facebook and Instagram lead ads, syncing those leads into Travelbot, and reporting campaign performance. Campaign creation, budget edits, and pause/resume controls can be added in a later ads-management release.
        </p>
      </div>
    </div>
  );
}
