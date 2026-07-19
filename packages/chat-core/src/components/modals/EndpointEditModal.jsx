import React, { useState, useEffect } from 'react';
import { Save, Activity, Globe, Info } from 'lucide-react';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

const PROVIDER_PROFILES = {
  gemini: {
    displayName: 'Gemini 官方',
    baseUrl: '— 官方直连 (Official) —',
    payloadFormat: 'gemini',
    cacheTransport: 'remote_reference',
    attachmentTransports: 'file_uri, inline_text, inline_image',
    families: 'gemini'
  },
  deepseek: {
    displayName: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com/v1',
    payloadFormat: 'openai',
    cacheTransport: 'inline_chunk',
    attachmentTransports: 'file_id, inline_text',
    families: 'deepseek'
  },
  openrouter: {
    displayName: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    payloadFormat: 'openai',
    cacheTransport: 'inline_chunk',
    attachmentTransports: 'inline_text, inline_image',
    families: 'gemini, deepseek, openrouter'
  },
  glm: {
    displayName: 'GLM 官方',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    payloadFormat: 'openai',
    cacheTransport: 'inline_chunk',
    attachmentTransports: 'inline_text',
    families: 'glm'
  }
};

export default function EndpointEditModal({ isOpen, onClose, endpoint, apiKeys = [], onSaved }) {
  const [form, setForm] = useState({
    name: '',
    provider: 'gemini',
    api_key_alias: '',
    enabled: true,
  });

  const [isSaving, setIsSaving] = useState(false);

  // Sync state when endpoint prop changes or modal opens
  useEffect(() => {
    if (endpoint) {
      setForm({
        name: endpoint.name || '',
        provider: endpoint.provider || 'gemini',
        api_key_alias: endpoint.api_key_alias || '',
        enabled: endpoint.enabled !== false,
      });
    } else {
      // Defaults for a new endpoint
      setForm({
        name: '',
        provider: 'gemini',
        api_key_alias: '',
        enabled: true,
      });
    }
  }, [endpoint, isOpen]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('请输入端点名称');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        api_key_alias: form.api_key_alias || null,
        enabled: form.enabled,
      };

      const { configApi } = await import('exo-shared');

      if (endpoint) {
        await configApi.updateEndpoint(endpoint.id, payload);
      } else {
        await configApi.createEndpoint(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      console.error('Endpoint 保存失败', err);
      if (err.status === 404 || err.message?.includes('Failed to fetch')) {
        onSaved();
        onClose();
      } else {
        alert(`保存失败: ${err.body?.detail || err.message}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const profile = PROVIDER_PROFILES[form.provider] || {
    displayName: '自定义渠道',
    baseUrl: '由 Provider 模板决定',
    payloadFormat: 'openai',
    cacheTransport: 'inline_chunk',
    attachmentTransports: 'inline_text',
    families: form.provider
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Globe}
      title={endpoint ? 'EDIT ENDPOINT' : 'NEW ENDPOINT'}
      subtitle={endpoint ? `Configuring ID: ${endpoint.id}` : 'Create a new model channel'}
      maxW="lg"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
            {isSaving ? 'COMMITTING...' : 'SAVE ENDPOINT'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Name */}
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Name / 端点名称</label>
          <input
            className={FIELD_INPUT}
            placeholder="e.g. Gemini Official"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          />
        </div>

        {/* Provider */}
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Provider / 渠道</label>
          <select
            className={`${FIELD_INPUT} cursor-pointer appearance-none`}
            value={form.provider}
            onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
          >
            <option value="gemini" className="bg-exo-pure">Gemini</option>
            <option value="deepseek" className="bg-exo-pure">DeepSeek</option>
            <option value="openrouter" className="bg-exo-pure">OpenRouter</option>
            <option value="glm" className="bg-exo-pure">GLM</option>
          </select>
        </div>

        {/* Credentials / API Key Alias */}
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Credentials / 关联密钥</label>
          <select
            className={`${FIELD_INPUT} cursor-pointer appearance-none`}
            value={form.api_key_alias}
            onChange={e => setForm(p => ({ ...p, api_key_alias: e.target.value }))}
          >
            <option value="" className="bg-exo-pure">— Select Key Alias —</option>
            {apiKeys.map(k => (
              <option key={k.alias} value={k.alias} className="bg-exo-pure">
                {k.alias} ({k.platform})
              </option>
            ))}
          </select>
        </div>

        {/* Enabled Toggle */}
        <div className="space-y-2 col-span-2 sm:col-span-1 flex items-center pt-5 gap-3">
          <input
            type="checkbox"
            id="endpoint-enabled"
            checked={form.enabled}
            onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-cinder-line bg-transparent accent-chat-accent cursor-pointer"
          />
          <label htmlFor="endpoint-enabled" className="text-sm font-mono cursor-pointer tx-system-normal select-none">
            Enabled / 启用端点
          </label>
        </div>
      </div>

      {/* Derived Configuration Profile (Read Only info) */}
      <div className="border-t border-exo-mist-10/20 pt-4 mt-6">
        <h4 className="text-xs font-mono tx-system-accent flex items-center gap-1.5 mb-3">
          <Info size={13} />
          Provider Template Properties (派生配置 - 只读)
        </h4>
        <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-cinder-line rounded-lg p-4 space-y-3 font-mono text-[11px]">
          <div className="grid grid-cols-3 gap-2">
            <span className="tx-system-mute uppercase text-[9px]">Base URL:</span>
            <span className="col-span-2 tx-system-normal truncate">{profile.baseUrl}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="tx-system-mute uppercase text-[9px]">Payload Format:</span>
            <span className="col-span-2 tx-system-normal uppercase">{profile.payloadFormat}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="tx-system-mute uppercase text-[9px]">Cache Transport:</span>
            <span className="col-span-2 tx-system-normal">{profile.cacheTransport}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="tx-system-mute uppercase text-[9px]">Attachment Transports:</span>
            <span className="col-span-2 tx-system-normal">{profile.attachmentTransports}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <span className="tx-system-mute uppercase text-[9px]">Supported Families:</span>
            <span className="col-span-2 tx-system-normal">{profile.families}</span>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
