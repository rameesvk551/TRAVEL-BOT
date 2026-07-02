// FILE: /frontend/src/utils/permissions.js
//
// Frontend permission check that mirrors the backend requirePermission logic:
// ADMINs implicitly have every permission; staff must hold the exact key.

/**
 * @param {{ role?: string, permissions?: string[] } | null | undefined} agent
 * @param {string} permissionKey e.g. 'properties.manage'
 * @returns {boolean}
 */
export function agentHasPermission(agent, permissionKey) {
  if (!agent) return false;
  if (agent.role === 'ADMIN') return true;
  return Array.isArray(agent.permissions) && agent.permissions.includes(permissionKey);
}
