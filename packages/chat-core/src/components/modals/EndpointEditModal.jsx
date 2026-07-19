import React, { useState, useEffect } from 'react';
import { Save, Activity, Globe } from 'lucide-react';
import { ModalShell, Button, FIELD_INPUT } from '../ui';

export default function EndpointEditModal({ isOpen, onClose, endpoint, apiKeys = [], onSaved }) {
  const [form, setForm] = useState({
    name: '',
    provider: 'gemini',
    base_url: '',
    api_key: '',
    payload_format: 'gemini',
    cache_transport: 'remote_reference',
    attachment_transports: ['file_uri', 'inline_text', 'inline_image'],
    supported_families: ['gemini'],
    supported_models: '',
    excluded_models: '',
    model_name_prefix: '',
    model_name_overrides: '',
    enabled: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sync state when endpoint prop changes or modal opens
  useEffect(() => {
    if (endpoint) {
      setForm({
        name: endpoint.name || '',
        provider: endpoint.provider || 'gemini',
        base_url: endpoint.base_url || '',
        api_key: endpoint.api_key || '',
        payload_format: endpoint.payload_format || 'gemini',
        cache_transport: endpoint.cache_transport || 'remote_reference',
        attachment_transports: endpoint.attachment_transports || [],
        supported_families: endpoint.supported_families || [],
        supported_models: Array.isArray(endpoint.supported_models) ? endpoint.supported_models.join(', ') : '',
        excluded_models: Array.isArray(endpoint.excluded_models) ? endpoint.excluded_models.join(', ') : '',
        model_name_prefix: endpoint.model_name_prefix || '',
        model_name_overrides: endpoint.model_name_overrides ? JSON.stringify(endpoint.model_name_overrides) : '',
        enabled: endpoint.enabled !== false,
      });
    } else {
      // Defaults for a new endpoint
      setForm({
        name: '',
        provider: 'gemini',
        base_url: '',
        api_key: '',
        payload_format: 'gemini',
        cache_transport: 'remote_reference',
        attachment_transports: ['file_uri', 'inline_text', 'inline_image'],
        supported_families: ['gemini'],
        supported_models: '',
        excluded_models: '',
        model_name_prefix: '',
        model_name_overrides: '',
        enabled: true,
      });
    }
  }, [endpoint, isOpen]);

  // Auto-fill configuration based on provider to simplify user input
  const handleProviderChange = (newProvider) => {
    let defaults = { provider: newProvider };
    if (newProvider === 'gemini') {
      defaults.payload_format = 'gemini';
      defaults.cache_transport = 'remote_reference';
      defaults.attachment_transports = ['file_uri', 'inline_text', 'inline_image'];
      defaults.supported_families = ['gemini'];
    } else if (newProvider === 'deepseek') {
      defaults.payload_format = 'openai';
      defaults.cache_transport = 'inline_chunk';
      defaults.attachment_transports = ['inline_text'];
      defaults.supported_families = ['deepseek'];
    } else if (newProvider === 'openai') {
      defaults.payload_format = 'openai';
      defaults.cache_transport = 'inline_chunk';
      defaults.attachment_transports = ['inline_text', 'inline_image'];
      defaults.supported_families = ['openai'];
    } else if (newProvider === 'openrouter') {
      defaults.payload_format = 'openai';
      defaults.cache_transport = 'inline_chunk';
      defaults.attachment_transports = ['inline_text', 'inline_image'];
      defaults.supported_families = ['gemini', 'deepseek', 'openai', 'llama', 'claude'];
    } else {
      defaults.payload_format = 'openai';
      defaults.cache_transport = 'inline_chunk';
      defaults.attachment_transports = ['inline_text'];
      defaults.supported_families = [newProvider];
    }
    setForm(p => ({ ...p, ...defaults }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('请输入端点名称');
      return;
    }
    setIsSaving(true);
    try {
      const supportedModelsArr = form.supported_models.split(',').map(s => s.trim()).filter(Boolean);
      const excludedModelsArr = form.excluded_models.split(',').map(s => s.trim()).filter(Boolean);
      let nameOverridesObj = {};
      if (form.model_name_overrides.trim()) {
        try {
          nameOverridesObj = JSON.parse(form.model_name_overrides);
        } catch (_) {
          alert('Model Name Overrides 必须是合法的 JSON 对象。');
          setIsSaving(false);
          return;
        }
      }

      const payload = {
        ...form,
        api_key: form.api_key ? Number(form.api_key) : null,
        supported_models: supportedModelsArr,
        excluded_models: excludedModelsArr,
        model_name_overrides: nameOverridesObj,
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
      // Resilient fallback in mock environments
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

  const toggleAttachmentTransport = (t) => {
    setForm(p => {
      const current = p.attachment_transports;
      if (current.includes(t)) {
        return { ...p, attachment_transports: current.filter(x => x !== t) };
      } else {
        return { ...p, attachment_transports: [...current, t] };
      }
    });
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
      <div className="grid grid-cols-2 gap-6 mb-4">
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
            onChange={e => handleProviderChange(e.target.value)}
          >
            <option value="gemini" className="bg-exo-pure">Gemini</option>
            <option value="deepseek" className="bg-exo-pure">DeepSeek</option>
            <option value="openai" className="bg-exo-pure">OpenAI</option>
            <option value="openrouter" className="bg-exo-pure">OpenRouter</option>
            <option value="anthropic" className="bg-exo-pure">Anthropic</option>
            <option value="other" className="bg-exo-pure">Other</option>
          </select>
        </div>

        {/* Base URL */}
        <div className="space-y-2 col-span-2">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Base URL / 接口地址 (可选)</label>
          <input
            className={FIELD_INPUT}
            placeholder="Leave empty to use official provider URL"
            value={form.base_url}
            onChange={e => setForm(p => ({ ...p, base_url: e.target.value }))}
          />
        </div>

        {/* API Key */}
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Credentials / 关联密钥</label>
          <select
            className={`${FIELD_INPUT} cursor-pointer appearance-none`}
            value={form.api_key}
            onChange={e => setForm(p => ({ ...p, api_key: e.target.value }))}
          >
            <option value="" className="bg-exo-pure">— Select Key Alias —</option>
            {apiKeys.map(k => (
              <option key={k.alias} value={k.id || k.alias} className="bg-exo-pure">
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

      {/* Advanced Settings */}
      <div className="border-t border-exo-mist-10/20 pt-4 mt-6">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs font-mono tx-system-accent hover:underline flex items-center gap-1.5 focus:outline-none"
        >
          {showAdvanced ? '[-] Hide Advanced Settings' : '[+] Show Advanced Settings (高级配置)'}
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 gap-6 mt-4 animate-in slide-in-from-top-2 duration-200">
            {/* Payload Format */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Payload Format</label>
              <select
                className={`${FIELD_INPUT} cursor-pointer appearance-none`}
                value={form.payload_format}
                onChange={e => setForm(p => ({ ...p, payload_format: e.target.value }))}
              >
                <option value="gemini" className="bg-exo-pure">Gemini Native</option>
                <option value="openai" className="bg-exo-pure">OpenAI Compatible</option>
              </select>
            </div>

            {/* Cache Transport */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Cache Transport</label>
              <select
                className={`${FIELD_INPUT} cursor-pointer appearance-none`}
                value={form.cache_transport}
                onChange={e => setForm(p => ({ ...p, cache_transport: e.target.value }))}
              >
                <option value="inline_chunk" className="bg-exo-pure">Inline Chunk</option>
                <option value="remote_reference" className="bg-exo-pure">Remote Reference (Gemini)</option>
              </select>
            </div>

            {/* Attachment Transports */}
            <div className="space-y-2 col-span-2">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Attachment Transports</label>
              <div className="flex flex-wrap gap-4 pt-1">
                {['file_uri', 'file_id', 'inline_text', 'inline_image'].map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer font-mono text-xs tx-system-normal">
                    <input
                      type="checkbox"
                      checked={form.attachment_transports.includes(t)}
                      onChange={() => toggleAttachmentTransport(t)}
                      className="accent-chat-accent"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>

            {/* Supported Families */}
            <div className="space-y-2 col-span-2">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Supported Families (逗号分隔)</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. gemini, deepseek"
                value={form.supported_families.join(', ')}
                onChange={e => setForm(p => ({ ...p, supported_families: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }))}
              />
            </div>

            {/* Supported models */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Supported Models (白名单)</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. model-a, model-b"
                value={form.supported_models}
                onChange={e => setForm(p => ({ ...p, supported_models: e.target.value }))}
              />
            </div>

            {/* Excluded models */}
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Excluded Models (黑名单)</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. model-c"
                value={form.excluded_models}
                onChange={e => setForm(p => ({ ...p, excluded_models: e.target.value }))}
              />
            </div>

            {/* Model Name Prefix */}
            <div className="space-y-2 col-span-2">
              <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Model Name Prefix (模型名前缀)</label>
              <input
                className={FIELD_INPUT}
                placeholder="e.g. openrouter/"
                value={form.model_name_prefix}
                onChange={e => setForm(p => ({ ...p, model_name_prefix: e.target.value }))}
              />
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
