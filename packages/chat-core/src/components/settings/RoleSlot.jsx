import React, { useState, useRef } from 'react';
import { configApi } from 'exo-shared';
import { Save, Trash2, AlertCircle } from 'lucide-react';
import Toast from './Toast';

const ROLE_LABELS = {
  system:     'System Default',
  session:    'Session Default',
  sub_agent:  'Sub-agent Default',
  background: 'Background Default',
};

const ROLE_REQUIRED = {
  system:     true,
  session:    false,
  sub_agent:  false,
  background: false,
};

export default function RoleSlot({ role, platform, existing, onSaved }) {
  const isRequired = ROLE_REQUIRED[role];
  const label = ROLE_LABELS[role];

  // Form state
  const [alias, setAlias] = useState(existing?.alias || '');
  const [keyValue, setKeyValue] = useState('');
  const [maskedDisplay, setMaskedDisplay] = useState(
    existing?.last_four ? `...${existing.last_four}` : ''
  );
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Ref to track full key value for delta parsing (avoids stale closure issues)
  const keyValueRef = useRef('');

  // UI state
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Pre-validation
  const aliasEmpty = alias.trim() === '';
  const keyNeeded = !existing || showKeyInput;
  const keyEmpty = keyNeeded && keyValue.trim() === '';
  const canSave = !aliasEmpty && !keyEmpty && !saving;

  const clearFeedback = () => setFeedback(null);

  // ── Key input: show "...last4" mask while tracking full value ──
  const handleKeyChange = (e) => {
    const newDisplay = e.target.value;
    if (newDisplay === maskedDisplay) return;

    let newKey;

    if (newDisplay.startsWith('...')) {
      // User is editing with mask prefix visible
      const newSuffix = newDisplay.slice(3);

      if (newDisplay.length > maskedDisplay.length) {
        // Characters added (typing or paste)
        const oldSuffix = keyValueRef.current.length >= 4
          ? keyValueRef.current.slice(-4)
          : keyValueRef.current;

        if (newSuffix.startsWith(oldSuffix)) {
          // Appended after visible suffix
          newKey = keyValueRef.current + newSuffix.slice(oldSuffix.length);
        } else {
          // Pasted or replaced — preserve hidden prefix
          const prefix = keyValueRef.current.length > 4
            ? keyValueRef.current.slice(0, -4)
            : '';
          newKey = prefix + newSuffix;
        }
      } else {
        // Characters deleted (backspace at end of visible suffix)
        const charsRemoved = maskedDisplay.length - newDisplay.length;
        newKey = keyValueRef.current.slice(0, -charsRemoved);
      }
    } else {
      // No mask prefix — user is typing fresh or pasted full key
      newKey = newDisplay;
    }

    keyValueRef.current = newKey;
    setKeyValue(newKey);

    if (newKey.length >= 4) {
      setMaskedDisplay(`...${newKey.slice(-4)}`);
    } else if (newKey.length > 0) {
      setMaskedDisplay(`...${newKey}`);
    } else {
      setMaskedDisplay('');
    }
  };

  // ── Save handler ──
  const handleSave = async () => {
    clearFeedback();
    if (!canSave) return;
    setSaving(true);

    try {
      if (!existing) {
        // Step 1: Create new key
        const created = await configApi.createApiKey({
          alias: alias.trim(),
          platform,
          key_value: keyValue.trim(),
        });
        // Step 2: Assign this key to its role in key_map (all 4 roles required)
        const config = await configApi.getConfig();
        const currentMap = config.key_map || {};
        const prev = currentMap[platform] || {};
        const platformMap = {
          system:     role === 'system'     ? created.id : (prev.system ?? null),
          session:    role === 'session'    ? created.id : (prev.session ?? null),
          sub_agent:  role === 'sub_agent'  ? created.id : (prev.sub_agent ?? null),
          background: role === 'background' ? created.id : (prev.background ?? null),
        };
        await configApi.updateKeyMap({ ...currentMap, [platform]: platformMap });
        // Both succeeded
        setKeyValue('');
        setMaskedDisplay('');
        keyValueRef.current = '';
        setFeedback({ type: 'success', msg: '保存成功' });
        onSaved?.();
      } else if (showKeyInput) {
        // Overwrite key value
        await configApi.overwriteApiKey(existing.id, keyValue.trim());
        setKeyValue('');
        setMaskedDisplay(existing.last_four ? `...${existing.last_four}` : '');
        keyValueRef.current = '';
        setShowKeyInput(false);
        setFeedback({ type: 'success', msg: 'Key 已更新' });
        onSaved?.();
      } else {
        // Update alias only
        await configApi.updateApiKeyAlias(existing.id, alias.trim());
        setFeedback({ type: 'success', msg: 'Alias 已更新' });
        onSaved?.();
      }
    } catch (err) {
      const msg = err.body?.detail || err.body?.error || err.message || '保存失败';
      setFeedback({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete handler ──
  const handleDelete = async () => {
    if (!existing) return;
    if (!window.confirm(`删除 key "${existing.alias}"？这将级联删除所有同值 key。`)) return;
    clearFeedback();
    setSaving(true);
    try {
      await configApi.deleteApiKey(existing.id);
      setAlias('');
      setMaskedDisplay('');
      keyValueRef.current = '';
      setFeedback({ type: 'success', msg: '删除成功' });
      onSaved?.();
    } catch (err) {
      const msg = err.body?.detail || err.body?.error || err.message || '删除失败';
      setFeedback({ type: 'error', msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-chat-panel border border-white/5 rounded-lg p-5 space-y-4">
      {/* Role header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-[0.15em] text-chat-text/80">
            {label}
          </span>
          {isRequired && (
            <span className="text-[9px] font-mono text-chat-accent/70 uppercase tracking-wider">
              (required)
            </span>
          )}
        </div>
        {existing && (
          <button
            onClick={handleDelete}
            disabled={saving}
            className="p-1 text-chat-muted/40 hover:text-red-400 transition-colors disabled:opacity-30"
            title="删除此 key"
          >
            <Trash2 size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Alias input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
          Alias {isRequired && '*'}
        </label>
        <input
          type="text"
          name={`alias-${role}-${platform}`}
          value={alias}
          onChange={e => setAlias(e.target.value)}
          onBlur={clearFeedback}
          placeholder={isRequired ? '必填，例如：我的主力key' : '选填'}
          maxLength={50}
          className="w-full px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
        />
        {aliasEmpty && (
          <p className="text-[10px] text-red-400/70 font-mono flex items-center gap-1">
            <AlertCircle size={10} /> Alias is required
          </p>
        )}
      </div>

      {/* Key input */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-mono uppercase tracking-wider text-chat-muted/60">
          Key {!existing && '*'}
        </label>

        {!existing || showKeyInput ? (
          <input
            type="text"
            name={`key-${role}-${platform}`}
            value={maskedDisplay}
            onChange={handleKeyChange}
            onPaste={(e) => {
              // On paste, capture the full pasted text directly
              e.preventDefault();
              const pasted = (e.clipboardData || window.clipboardData).getData('text');
              if (!pasted) return;
              const cleaned = pasted.replace(/\s+/g, ''); // strip whitespace
              keyValueRef.current = cleaned;
              setKeyValue(cleaned);
              if (cleaned.length >= 4) {
                setMaskedDisplay(`...${cleaned.slice(-4)}`);
              } else if (cleaned.length > 0) {
                setMaskedDisplay(`...${cleaned}`);
              } else {
                setMaskedDisplay('');
              }
            }}
            placeholder="粘贴 API Key..."
            autoComplete="off"
            className="w-full px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30 font-mono"
          />
        ) : (
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-muted font-mono select-all">
              {maskedDisplay || '—'}
            </code>
            <button
              onClick={() => { setShowKeyInput(true); setKeyValue(''); setMaskedDisplay(''); keyValueRef.current = ''; clearFeedback(); }}
              className="text-[10px] font-mono uppercase tracking-wider text-chat-accent/60 hover:text-chat-accent transition-colors whitespace-nowrap px-2 py-1"
            >
              覆盖
            </button>
          </div>
        )}

        {keyNeeded && keyValue.trim() === '' && !aliasEmpty && (
          <p className="text-[10px] text-red-400/70 font-mono flex items-center gap-1">
            <AlertCircle size={10} /> Key is required
          </p>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-5 py-2 bg-chat-accent text-white text-xs font-bold uppercase tracking-[0.15em] rounded hover:brightness-110 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-2"
        >
          {saving ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          保存
        </button>
      </div>

      {/* Toast notification */}
      <Toast
        type={feedback?.type}
        message={feedback?.msg}
        onClose={clearFeedback}
      />
    </div>
  );
}
