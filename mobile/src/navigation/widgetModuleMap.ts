// FILE: mobile/src/navigation/widgetModuleMap.ts
// Maps each Home widget key to the module it depends on.
// If a widget's required module isn't in manifest.modules, it is skipped
// by the Home dashboard (no empty cards for disabled features).

/**
 * Widget key → required module key.
 * If a widget has no dependency (always shown), it maps to null.
 */
export const WIDGET_MODULE_MAP: Record<string, string | null> = {
  // Travel
  newLeads: 'leads',
  conversion: 'leads',
  bookings: 'bookings',
  revenue: 'payments',
  departures: 'bookings',
  attention: null,               // Always shown — composite

  // Resort
  occupancy: 'bookings',         // Reservations engine
  todaysCheckins: 'bookings',

  // Cleaning
  todaysJobs: 'bookings',        // Jobs engine
  crewStatus: 'agents',

  // Laundry
  todaysOrders: 'bookings',      // Orders engine
  readyForDelivery: 'bookings',

  // CRM/Marketing
  campaignReach: 'campaigns',
  reviews: 'reviews',
};

/**
 * Filter the manifest's home widgets to only those whose backing module
 * is enabled. Used by the Home dashboard to skip unavailable widgets.
 */
export function filterWidgets(
  widgets: string[],
  enabledModules: string[],
): string[] {
  const enabled = new Set(enabledModules);
  return widgets.filter((widget) => {
    const requiredModule = WIDGET_MODULE_MAP[widget];
    // null = always show; undefined = unknown widget, show anyway (forward-compat)
    if (requiredModule === null || requiredModule === undefined) return true;
    return enabled.has(requiredModule);
  });
}
