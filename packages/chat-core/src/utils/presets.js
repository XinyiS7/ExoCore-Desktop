export const isSuperiorType = (type) => type === 'superior' || type === 'g045';

/**
 * 获取 Agent Hub 的手动排序顺序
 */
export const getAgentHubOrder = () => {
  try {
    return JSON.parse(localStorage.getItem('agentHubOrder') || '{}');
  } catch {
    return {};
  }
};

/**
 * 根据手动排序顺序对 Presets 进行排序
 * 如果没有排序记录，则默认按 ID 升序（或者可以保持原序）
 */
export const sortPresets = (presets) => {
  if (!presets || !Array.isArray(presets)) return [];
  const order = getAgentHubOrder();
  
  return [...presets].sort((a, b) => {
    // 1. 优先级：superior 核心置顶
    const typeA = isSuperiorType(a.agent_type) ? 0 : 1;
    const typeB = isSuperiorType(b.agent_type) ? 0 : 1;
    if (typeA !== typeB) return typeA - typeB;
    
    // 2. 优先级：手动排序顺序
    const hasOrderA = order[a.id] !== undefined;
    const hasOrderB = order[b.id] !== undefined;
    
    if (hasOrderA && hasOrderB) {
      return order[a.id] - order[b.id];
    }
    
    // 如果只有一个有手动排序，有排序的排在前面（在其类型组内）
    if (hasOrderA) return -1;
    if (hasOrderB) return 1;
    
    // 3. 兜底：按 ID 升序（模拟后端默认顺序）
    return a.id - b.id;
  });
};
