/**
 * P1D Tactical HUD overlay (Plan Task 3, D2).
 *
 * A non-reflowing overlay anchored below the top bar (top sheet on mobile):
 * - opening it never resizes the message scroll area or the composer;
 * - focus entry/containment/restoration + Escape/backdrop close via the
 *   accepted `useDialogA11y` pattern;
 * - controls grouped into target / thinking+transport / cache+history /
 *   memory (g045 only) / aura;
 * - request-affecting controls are disabled while `runtimeUncertain`
 *   (accepted/uncertain chat operation) so the HUD cannot imply it changed
 *   an in-flight run (Plan §4.3);
 * - controls whose state owner lives in pane 5 (target/transport) are
 *   controlled props; when the owner is not yet wired they render disabled
 *   with an honest note instead of pretending to work.
 */
import { useMemo, useState } from 'react';
import {
  changeTargetModel,
  getCompatibleEndpoints,
  getMainRoles,
} from 'exo-shared/models';
import type { ChatTransport, ConversationTelemetryProjection } from '../runtime/types';
import { toAppApiError } from '../api';
import { useModelCatalogQuery } from '../audio/audioTarget';
import type { CacheControlApi } from '../control/useCacheControl';
import { THINKING_LEVELS, type ThinkingLevel } from '../control/types';
import { useDialogA11y } from '../dialogA11y';
import { ContextCacheControl } from './ContextCacheControl';
import { AuraPicker } from '../aura/AuraPicker';
import type { UseAuraResult } from '../aura/useAura';

const THINKING_LABELS: Record<ThinkingLevel, string> = {
  off: '关闭',
  auto: '自动',
  low: '低',
  medium: '中',
  high: '高',
  max: '最大',
};

export interface SessionTargetSummary {
  model: string;
  endpoint: number | null;
}

export interface TacticalHudProps {
  open: boolean;
  onClose: () => void;
  /** Runtime uncertainty (busy/reconcile/uncertain) from the operation owner. */
  runtimeUncertain: boolean;
  /** Effective current target (pane-5 controls hook); null before resolve. */
  target: SessionTargetSummary | null;
  /** Target change callback (pane-5 owner). Absent → selectors stay disabled. */
  onTargetChange?: (target: SessionTargetSummary) => void;
  /** Global transport preference (runtime owner). Absent → selector disabled. */
  transport: ChatTransport;
  onTransportChange?: (transport: ChatTransport) => void;
  /** Backend thinking truth and mutation state from the single controls hook. */
  thinkingLevel: string | null;
  thinkingSaveState?: {
    kind: 'idle' | 'saving' | 'rejected' | 'uncertain';
    message?: string;
  };
  onThinkingChange?: (level: ThinkingLevel) => void;
  onThinkingRetry?: () => void;
  cacheControl?: CacheControlApi;
  cacheEnabled?: boolean;
  onCacheEnabledChange?: (enabled: boolean) => void;
  sessionType?: 'full' | 'lite';
  onSessionTypeChange?: (mode: 'full' | 'lite') => void;
  memoryInjectionEnabled?: boolean;
  onMemoryInjectionChange?: (enabled: boolean) => void;
  /** g045-only memory control visibility. */
  isG045: boolean;
  theme?: 'dark' | 'light';
  /** Controlled page-owned Aura state; absent only in isolated loading harnesses. */
  aura?: UseAuraResult;
  /** Runtime-owned page-visit telemetry; never reconstructed from history. */
  telemetry?: ConversationTelemetryProjection;
  /** Non-blocking storage/pref warnings surface (page-local notice owner). */
  onStorageWarning?: (message: string) => void;
}

export function TacticalHud({
  open,
  onClose,
  runtimeUncertain,
  target,
  onTargetChange,
  transport,
  onTransportChange,
  thinkingLevel,
  thinkingSaveState = { kind: 'idle' },
  onThinkingChange,
  onThinkingRetry,
  cacheControl,
  cacheEnabled = true,
  onCacheEnabledChange,
  sessionType = 'lite',
  onSessionTypeChange,
  memoryInjectionEnabled = true,
  onMemoryInjectionChange,
  isG045,
  theme = 'dark',
  aura,
  telemetry,
  onStorageWarning,
}: TacticalHudProps) {
  const hudRef = useDialogA11y(open, onClose);
  const catalogQuery = useModelCatalogQuery();
  const [localWarnings, setLocalWarnings] = useState<string[]>([]);

  // Hooks must run before the early return; catalog dependency is stable.
  const catalogForModels = catalogQuery.data ?? null;
  const mainModels = useMemo(() => {
    if (!catalogForModels) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const role of getMainRoles(catalogForModels)) {
      if (role.model && !seen.has(role.model)) {
        seen.add(role.model);
        out.push(role.model);
      }
    }
    return out;
  }, [catalogForModels]);

  const warn = (message: string) => {
    onStorageWarning?.(message);
    setLocalWarnings((prev) => (prev.includes(message) ? prev : [...prev.slice(-3), message]));
  };

  const dismissWarning = (message: string) =>
    setLocalWarnings((prev) => prev.filter((m) => m !== message));

  if (!open) return null;

  const catalog = catalogQuery.data ?? null;
  const modelOptions = target && !mainModels.includes(target.model) && target.model
    ? [target.model, ...mainModels]
    : mainModels;
  const compatibleEndpoints = target?.model
    ? getCompatibleEndpoints(catalog, target.model)
    : [];
  const targetNotWired = onTargetChange === undefined;
  const transportNotWired = onTransportChange === undefined;

  const currentThinking: ThinkingLevel =
    thinkingLevel && (THINKING_LEVELS as readonly string[]).includes(thinkingLevel)
      ? (thinkingLevel as ThinkingLevel)
      : 'auto';

  const handleModelChange = (model: string) => {
    if (!onTargetChange || !target) return;
    const resolved = changeTargetModel(catalog, target, model);
    onTargetChange({ model: resolved.model, endpoint: resolved.endpoint });
  };

  const handleEndpointChange = (endpointId: number) => {
    if (!onTargetChange || !target) return;
    onTargetChange({ model: target.model, endpoint: endpointId });
  };

  const catalogError = catalogQuery.error ? toAppApiError(catalogQuery.error) : null;

  return (
    <div className="v4-hud-backdrop" onClick={onClose} role="presentation">
      <section
        ref={hudRef}
        className="v4-hud"
        role="dialog"
        aria-modal="true"
        aria-label="战术控制面板"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="v4-hud-head">
          <h2 className="app-h2">战术面板</h2>
          <button type="button" className="app-icon-btn" onClick={onClose} aria-label="关闭战术面板">
            ✕
          </button>
        </header>

        <div className="v4-hud-body">
          {localWarnings.length > 0 ? (
            <div className="v4-hud-warnings">
              {localWarnings.map((message) => (
                <p key={message} className="v4-hud-warning" role="status">
                  {message}
                  <button type="button" onClick={() => dismissWarning(message)} aria-label="关闭提示">
                    ✕
                  </button>
                </p>
              ))}
            </div>
          ) : null}

          {/* ── 执行目标 ── */}
          <section className="v4-hud-group" aria-labelledby="v4-hud-target-title">
            <h3 id="v4-hud-target-title" className="v4-hud-title">
              执行目标
            </h3>
            {catalogQuery.isPending ? (
              <p className="app-muted">正在读取模型目录…</p>
            ) : catalogError ? (
              <div className="v4-hud-state" role="alert">
                <span className="app-error-hint">{catalogError.message}</span>
                <button
                  type="button"
                  className="app-btn app-btn-ghost app-btn-xs"
                  onClick={() => void catalogQuery.refetch()}
                >
                  重试
                </button>
              </div>
            ) : (
              <>
                <label className="v4-hud-field">
                  <span>模型</span>
                  <select
                    className="app-input"
                    value={target?.model ?? ''}
                    onChange={(e) => handleModelChange(e.target.value)}
                    disabled={runtimeUncertain || targetNotWired || modelOptions.length === 0}
                    aria-label="选择模型"
                  >
                    {modelOptions.length === 0 ? (
                      <option value="">目录中无可用模型</option>
                    ) : (
                      modelOptions.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="v4-hud-field">
                  <span>端点</span>
                  <select
                    className="app-input"
                    value={target?.endpoint ?? -1}
                    onChange={(e) => handleEndpointChange(Number(e.target.value))}
                    disabled={
                      runtimeUncertain ||
                      targetNotWired ||
                      !target?.model ||
                      compatibleEndpoints.length === 0
                    }
                    aria-label="选择端点"
                  >
                    {!target?.model ? (
                      <option value={-1}>先选择模型</option>
                    ) : compatibleEndpoints.length === 0 ? (
                      <option value={-1}>该模型无可用端点</option>
                    ) : (
                      compatibleEndpoints.map((ep) => (
                        <option key={ep.id} value={ep.id}>
                          {ep.name}（{ep.provider}）
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {compatibleEndpoints.length > 0 && target?.endpoint === null ? (
                  <p className="app-muted">该模型有多个兼容端点，请手动选择。</p>
                ) : null}
                {targetNotWired ? (
                  <p className="app-muted">目标选择器待运行时初始化后可用。</p>
                ) : null}
              </>
            )}
          </section>

          {/* ── 思考与传输 ── */}
          <section className="v4-hud-group" aria-labelledby="v4-hud-think-title">
            <h3 id="v4-hud-think-title" className="v4-hud-title">
              思考与传输
            </h3>
            <label className="v4-hud-field">
              <span>思考级别</span>
              <select
                className="app-input"
                value={currentThinking}
                onChange={(e) => onThinkingChange?.(e.target.value as ThinkingLevel)}
                disabled={runtimeUncertain || thinkingSaveState.kind === 'saving'}
                aria-label="选择思考级别"
              >
                {THINKING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {THINKING_LABELS[level]}（{level}）
                  </option>
                ))}
              </select>
            </label>
            {thinkingSaveState.kind === 'saving' ? (
              <p className="app-muted">正在保存思考级别…</p>
            ) : thinkingSaveState.kind === 'rejected' || thinkingSaveState.kind === 'uncertain' ? (
              <div className="v4-hud-state" role="alert">
                <span className="app-error-hint">{thinkingSaveState.message}</span>
                <button type="button" className="app-btn app-btn-ghost app-btn-xs" onClick={onThinkingRetry} disabled={!onThinkingRetry}>
                  重试保存
                </button>
              </div>
            ) : null}

            <label className="v4-hud-field">
              <span>传输模式</span>
              <select
                className="app-input"
                value={transport}
                onChange={(e) => onTransportChange?.(e.target.value as ChatTransport)}
                disabled={runtimeUncertain || transportNotWired}
                aria-label="选择传输模式"
              >
                <option value="sse">实时（SSE）</option>
                <option value="async">可恢复（轮询）</option>
              </select>
            </label>
            {transportNotWired ? (
              <p className="app-muted">传输模式由运行时提供（待接线）。</p>
            ) : null}
          </section>

          {telemetry && telemetry.totals.acceptedRuns > 0 ? (
            <section className="v4-hud-group" aria-labelledby="v4-hud-telemetry-title">
              <h3 id="v4-hud-telemetry-title" className="v4-hud-title">
                本页用量观测
              </h3>
              <p className="app-muted">
                本次页面访问已收到 {telemetry.totals.acceptedRuns} 次运行用量上报；这不代表所有已接受请求。
              </p>
              {telemetry.lastTurn ? (
                <p className="app-muted">
                  最近上报：输入 {telemetry.lastTurn.inputChars ?? 0} · 输出 {telemetry.lastTurn.outputChars ?? 0} · 工具 {telemetry.lastTurn.toolCalls ?? 0}
                </p>
              ) : null}
              <p className="app-muted">
                本页上报合计：输入 {telemetry.totals.inputChars} · 输出 {telemetry.totals.outputChars} · 工具 {telemetry.totals.toolCalls} · 缓存输入 {telemetry.totals.cachedInputChars}
              </p>
            </section>
          ) : null}

          {/* ── 缓存与历史 ── */}
          <section className="v4-hud-group" aria-labelledby="v4-hud-cache-title">
            <h3 id="v4-hud-cache-title" className="v4-hud-title">
              缓存与历史
            </h3>
            {cacheControl ? (
              <ContextCacheControl
                cacheControl={cacheControl}
                runtimeUncertain={runtimeUncertain}
                cacheEnabled={cacheEnabled}
                onCacheEnabledChange={onCacheEnabledChange ?? (() => undefined)}
                onStorageWarning={warn}
              />
            ) : (
              <p className="app-muted"><span>上下文缓存</span><span>待页面初始化。</span></p>
            )}
            <label className="v4-hud-field">
              <span>历史装配</span>
              <select
                className="app-input"
                value={sessionType}
                onChange={(e) => onSessionTypeChange?.(e.target.value as 'full' | 'lite')}
                disabled={runtimeUncertain}
                aria-label="选择历史装配模式"
              >
                <option value="lite">精简（lite）</option>
                <option value="full">完整（full）</option>
              </select>
            </label>
          </section>

          {/* ── 私有记忆（g045 only） ── */}
          {isG045 ? (
            <section className="v4-hud-group" aria-labelledby="v4-hud-memory-title">
              <h3 id="v4-hud-memory-title" className="v4-hud-title">
                私有记忆
              </h3>
              <label className="v4-switch v4-switch--row">
                <input
                  type="checkbox"
                  checked={memoryInjectionEnabled}
                  onChange={() => onMemoryInjectionChange?.(!memoryInjectionEnabled)}
                  disabled={runtimeUncertain}
                  aria-label="启用私有记忆注入"
                />
                <span>
                  {memoryInjectionEnabled ? '启用记忆注入（每轮随请求发送）' : '关闭记忆注入（每轮随请求发送）'}
                </span>
              </label>
            </section>
          ) : null}

          {/* ── 氛围 ── */}
          <section className="v4-hud-group" aria-labelledby="v4-hud-aura-title">
            <h3 id="v4-hud-aura-title" className="v4-hud-title">
              氛围
            </h3>
            {aura ? (
              <AuraPicker
                selectedId={aura.selectedId}
                palettes={aura.palettes}
                onSelect={aura.select}
                onSaveNew={aura.saveNew}
                onUpdate={aura.update}
                onDelete={aura.remove}
                theme={theme}
                onStorageWarning={warn}
              />
            ) : (
              <p className="app-muted">氛围状态正在初始化。</p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}