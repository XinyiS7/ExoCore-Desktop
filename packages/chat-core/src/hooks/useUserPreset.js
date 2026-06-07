import { useState, useCallback, useMemo } from 'react';
import { agentsApi } from 'exo-shared';

/**
 * useUserPreset — resolve the user identity from the DB (AgentPreset with
 * agent_type='user').
 *
 * @param {Array} presets — appState.presets from usePresets()
 * @param {Function} refreshPresets — appState.refreshPresets
 * @returns {{ userPreset, updateUserPreset, saving, error }}
 */
export function useUserPreset(presets, refreshPresets) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const userPreset = useMemo(
    () => presets?.find(p => p.agent_type === 'user') || null,
    [presets]
  );

  // PATCH the user preset and refresh the presets list
  const updateUserPreset = useCallback(async (fields) => {
    if (!userPreset?.id) {
      setError('No user preset found — cannot update');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await agentsApi.updatePreset(userPreset.id, fields);
      if (refreshPresets) refreshPresets();
    } catch (err) {
      setError(err.body?.error || err.message || 'Failed to save');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [userPreset?.id, refreshPresets]);

  return { userPreset, updateUserPreset, saving, error };
}

