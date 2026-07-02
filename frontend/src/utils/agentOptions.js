export function mergeAssignedAgentOption(agents = [], lead = {}) {
  const options = Array.isArray(agents) ? [...agents] : [];
  const assignedAgent = lead?.assignedAgent;

  if (!assignedAgent?.id || options.some((agent) => agent.id === assignedAgent.id)) {
    return options;
  }

  return [
    {
      id: assignedAgent.id,
      name: assignedAgent.name || assignedAgent.email || 'Assigned Staff',
      email: assignedAgent.email,
    },
    ...options,
  ];
}
