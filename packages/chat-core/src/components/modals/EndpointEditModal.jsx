import { useEffect, useState } from "react";
import { Activity, Globe, Info, Save } from "lucide-react";
import { Button, FIELD_INPUT, ModalShell } from "../ui";

function formatList(value) {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "—";
}

function errorDetail(error) {
  if (error.body?.detail) return error.body.detail;
  if (typeof error.body === "string") return error.body;
  if (error.body) return JSON.stringify(error.body);
  return error.message;
}

export default function EndpointEditModal({
  isOpen,
  onClose,
  endpoint,
  apiKeys = [],
  providers = [],
  onSaved,
}) {
  const [form, setForm] = useState({
    name: "",
    provider: "",
    api_key_alias: "",
    enabled: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (endpoint) {
      setForm({
        name: endpoint.name || "",
        provider: endpoint.provider || "",
        api_key_alias: endpoint.api_key_alias || "",
        enabled: endpoint.enabled !== false,
      });
    } else {
      setForm({
        name: "",
        provider: "",
        api_key_alias: "",
        enabled: true,
      });
    }
  }, [endpoint, isOpen]);

  useEffect(() => {
    if (!endpoint && isOpen && providers.length > 0) {
      setForm(previous => (
        previous.provider
          ? previous
          : { ...previous, provider: providers[0].id }
      ));
    }
  }, [endpoint, isOpen, providers]);

  const profile = providers.find(item => item.id === form.provider);
  const requiresEndpointKey = profile?.requires_endpoint_api_key === true;
  const compatibleApiKeys = requiresEndpointKey
    ? apiKeys.filter(key => key.platform === profile.id)
    : [];

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("请输入端点名称");
      return;
    }
    if (!profile) {
      alert("Provider 模板不可用");
      return;
    }
    if (requiresEndpointKey && !form.api_key_alias) {
      alert("请选择与 Provider 匹配的 API key");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        provider: form.provider,
        api_key_alias: requiresEndpointKey
          ? form.api_key_alias
          : null,
        enabled: form.enabled,
      };
      const { configApi } = await import("exo-shared");

      if (endpoint) {
        await configApi.updateEndpoint(endpoint.id, payload);
      } else {
        await configApi.createEndpoint(payload);
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error("Endpoint 保存失败", error);
      alert(`保存失败: ${errorDetail(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      icon={Globe}
      title={endpoint ? "EDIT ENDPOINT" : "NEW ENDPOINT"}
      subtitle={endpoint ? `Configuring ID: ${endpoint.id}` : "Create a new model channel"}
      maxW="lg"
      footer={
        <div className="flex items-center justify-end gap-4">
          <Button variant="ghost" onClick={onClose}>ABORT</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isSaving || !profile}
          >
            {isSaving ? <Activity size={14} className="animate-spin" /> : <Save size={14} strokeWidth={1.5} />}
            {isSaving ? "COMMITTING..." : "SAVE ENDPOINT"}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Name / 端点名称</label>
          <input
            className={FIELD_INPUT}
            placeholder="e.g. Gemini Official"
            value={form.name}
            onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))}
          />
        </div>

        <div className="space-y-2 col-span-2 sm:col-span-1">
          <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Provider / 渠道</label>
          <select
            aria-label="Provider / 渠道"
            className={`${FIELD_INPUT} cursor-pointer appearance-none`}
            value={form.provider}
            onChange={event => setForm(previous => ({
              ...previous,
              provider: event.target.value,
              api_key_alias: "",
            }))}
          >
            {providers.map(item => (
              <option key={item.id} value={item.id} className="bg-exo-pure">
                {item.display_name}
              </option>
            ))}
          </select>
        </div>

        {profile && requiresEndpointKey ? (
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <label className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Credentials / 关联密钥</label>
            <select
              aria-label="Credentials / 关联密钥"
              className={`${FIELD_INPUT} cursor-pointer appearance-none`}
              value={form.api_key_alias}
              onChange={event => setForm(previous => ({ ...previous, api_key_alias: event.target.value }))}
            >
              <option value="" className="bg-exo-pure">— Select Key Alias —</option>
              {compatibleApiKeys.map(key => (
                <option key={key.alias} value={key.alias} className="bg-exo-pure">
                  {key.alias} ({key.platform})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2 col-span-2 sm:col-span-1">
            <span className="text-[0.65rem] font-mono tracking-[0.15em] tx-system-mute uppercase">Credentials / 关联密钥</span>
            <p className="text-xs font-mono tx-system-normal pt-2">
              {profile
                ? "不使用 Endpoint API key（外部 Runtime 凭证）"
                : "Provider 模板不可用"}
            </p>
          </div>
        )}

        <div className="space-y-2 col-span-2 sm:col-span-1 flex items-center pt-5 gap-3">
          <input
            type="checkbox"
            id="endpoint-enabled"
            checked={form.enabled}
            onChange={event => setForm(previous => ({ ...previous, enabled: event.target.checked }))}
            className="w-4 h-4 rounded border-cinder-line bg-transparent accent-chat-accent cursor-pointer"
          />
          <label htmlFor="endpoint-enabled" className="text-sm font-mono cursor-pointer tx-system-normal select-none">
            Enabled / 启用端点
          </label>
        </div>
      </div>

      <div className="border-t border-exo-mist-10/20 pt-4 mt-6">
        <h4 className="text-xs font-mono tx-system-accent flex items-center gap-1.5 mb-3">
          <Info size={13} />
          Provider Template Properties (派生配置 - 只读)
        </h4>
        {!profile ? (
          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-cinder-line rounded-lg p-4 font-mono text-[11px] text-rose-500">
            Provider 模板不可用
          </div>
        ) : (
          <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-cinder-line rounded-lg p-4 space-y-3 font-mono text-[11px]">
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Provider:</span>
              <span className="col-span-2 tx-system-normal">{profile.display_name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Execution:</span>
              <span className="col-span-2 tx-system-normal">
                {profile.execution_type} / {profile.execution_adapter}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Credential:</span>
              <span className="col-span-2 tx-system-normal">
                {requiresEndpointKey ? "需要 API key" : "不使用 Endpoint API key（外部 Runtime 凭证）"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Base URL:</span>
              <span className="col-span-2 tx-system-normal truncate">{profile.base_url || "—"}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Payload Format:</span>
              <span className="col-span-2 tx-system-normal uppercase">{profile.payload_format}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Cache Transport:</span>
              <span className="col-span-2 tx-system-normal">{profile.cache_transport}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Attachment Transports:</span>
              <span className="col-span-2 tx-system-normal">{formatList(profile.attachment_transports)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <span className="tx-system-mute uppercase text-[9px]">Supported Families:</span>
              <span className="col-span-2 tx-system-normal">{formatList(profile.supported_families)}</span>
            </div>
            {Object.entries(profile.model_name_overrides || {}).map(([logicalModel, providerModel]) => (
              <div className="grid grid-cols-3 gap-2" key={logicalModel}>
                <span className="tx-system-mute uppercase text-[9px]">Model Mapping:</span>
                <span className="col-span-2 tx-system-normal">
                  {logicalModel} → {providerModel}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}
