// 'JUST_CONTACTED' is retired: entry-stage leads carry an empty (null) status,
// so it is not offered as a selectable status. The pipeline column keeps the
// 'JUST_CONTACTED' key as a back-end alias for "status IS NULL".
export const LEAD_STATUS_OPTIONS = ['PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'CONTACTED', 'CONVERTED', 'LOST'];

export const LEAD_PIPELINE_COLUMNS = [
  { key: 'JUST_CONTACTED', label: 'New', color: 'sky' },
  { key: 'PACKAGE_SEARCHED', label: 'Package Searched', color: 'amber' },
  { key: 'PACKAGE_INTERESTED', label: 'Package Interested', color: 'indigo' },
  { key: 'CONTACTED', label: 'Contacted', color: 'violet' },
  { key: 'CONVERTED', label: 'Converted', color: 'emerald' },
  { key: 'LOST', label: 'Lost', color: 'rose' },
];