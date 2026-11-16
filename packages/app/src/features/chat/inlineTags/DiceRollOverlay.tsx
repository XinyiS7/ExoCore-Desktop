import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { DieSvg } from './DiceRenderer';
import { fontSizeForDieLabel, type DieFaces } from './diceTypes';

export interface DiceRollOverlayData {
  rollKey: string;
  by?: 'user' | 'assistant';
  conversationId: number;
  clientTurnId: string | null;
  assistantTagIndex?: number;
  dice: readonly { id: string; faces: DieFaces }[];
  modifier: number;
  expr: string;
  startedAt: number;
  result: { dice: number[]; total: number } | null;
}

export interface DiceRollOverlayProps {
  overlay: DiceRollOverlayData | null;
  onDismiss: (rollKey: string) => void;
  assistantName?: string;
}

type OverlayStage = 'rolling' | 'settling' | 'revealed' | 'fading';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function DiceRollOverlay({ overlay, onDismiss, assistantName }: DiceRollOverlayProps) {
  const reducedMotion = prefersReducedMotion();
  const [stage, setStage] = useState<OverlayStage>('rolling');
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastDomLabelRef = useRef<Map<string, number>>(new Map());
  const spinRef = useRef<{ values: number[]; angles: number[]; lastLabelSwap: number }>({
    values: [],
    angles: [],
    lastLabelSwap: 0,
  });

  const rollKey = overlay?.rollKey ?? null;
  const rollStartedAt = overlay?.startedAt ?? 0;
  const hasResult = Boolean(overlay?.result);

  const applyOverlayToDom = useCallback(
    (dice: readonly { id: string; faces: DieFaces }[], values: readonly number[], angles: readonly number[]) => {
      for (let i = 0; i < dice.length; i += 1) {
        const die = dice[i];
        const slot = slotRefs.current.get(die.id);
        if (!slot) continue;
        const svg = slot.firstElementChild as SVGSVGElement | null;
        if (!svg) continue;
        const angle = angles[i] ?? 0;
        svg.style.transform = angle !== 0 ? `rotate(${angle.toFixed(4)}rad)` : '';
        const val = values[i] ?? die.faces;
        if (lastDomLabelRef.current.get(die.id) !== val) {
          lastDomLabelRef.current.set(die.id, val);
          const textEl = svg.querySelector('text');
          if (textEl) {
            const textStr = String(val);
            textEl.textContent = textStr;
            textEl.setAttribute('font-size', fontSizeForDieLabel(textStr));
          }
        }
      }
    },
    [],
  );

  // Reset stage whenever a new roll begins
  useEffect(() => {
    const current = overlayRef.current;
    if (!current || !rollKey) return;
    lastDomLabelRef.current.clear();
    spinRef.current = {
      values: current.dice.map((d) => Math.max(1, Math.ceil(d.faces / 2))),
      angles: current.dice.map((_, i) => (i % 2 === 0 ? -0.35 : 0.35)),
      lastLabelSwap: 0,
    };
    setStage(current.result && reducedMotion ? 'revealed' : 'rolling');
  }, [rollKey, reducedMotion]);

  // Synchronize settled result labels & zero rotation on stage/result changes
  useLayoutEffect(() => {
    const current = overlayRef.current;
    if (!current) return;
    if (stage === 'revealed' || stage === 'fading') {
      const zeros = current.dice.map(() => 0);
      const finalValues = current.result ? current.result.dice : current.dice.map((d) => d.faces);
      applyOverlayToDom(current.dice, finalValues, zeros);
    } else if (stage === 'settling' && current.result) {
      spinRef.current.values = [...current.result.dice];
      applyOverlayToDom(current.dice, spinRef.current.values, spinRef.current.angles);
    }
  }, [overlay, stage, applyOverlayToDom]);

  // Cosmetic tumbling frames driven directly via DOM transforms (zero per-frame React re-renders)
  useEffect(() => {
    if (!rollKey || reducedMotion) return undefined;
    if (stage !== 'rolling' && stage !== 'settling') return undefined;

    let rafId = 0;
    let lastTick = performance.now();
    const tick = (now: number) => {
      const current = overlayRef.current;
      if (!current) return;
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      const spin = spinRef.current;
      if (stage === 'settling') {
        if (current.result) {
          spin.values = [...current.result.dice];
        }
        let stillSpinning = false;
        spin.angles = spin.angles.map((a) => {
          const nextA = Math.abs(a) < 0.02 ? 0 : a * Math.pow(0.05, dt);
          if (nextA !== 0) stillSpinning = true;
          return nextA;
        });
        applyOverlayToDom(current.dice, spin.values, spin.angles);
        if (!stillSpinning) return;
      } else {
        if (now - spin.lastLabelSwap >= 55) {
          spin.lastLabelSwap = now;
          spin.values = current.dice.map((d) => Math.floor(Math.random() * d.faces) + 1);
        }
        spin.angles = current.dice.map((_, i) => {
          const cur = spin.angles[i] ?? 0;
          const speed = (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 2.5);
          return cur + speed * dt;
        });
        applyOverlayToDom(current.dice, spin.values, spin.angles);
      }

      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [rollKey, stage, reducedMotion, applyOverlayToDom]);

  // Drive stage progression once authoritative backend result arrives (stays revealed until clicked)
  useEffect(() => {
    if (!rollKey || !hasResult) return undefined;

    if (reducedMotion) {
      setStage('revealed');
      return undefined;
    }

    const elapsed = performance.now() - rollStartedAt;
    const minRollWait = Math.max(0, 1350 - elapsed);
    let settleTimer = 0;

    const minTimer = window.setTimeout(() => {
      setStage('settling');
      settleTimer = window.setTimeout(() => {
        setStage('revealed');
      }, 420);
    }, minRollWait);

    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(settleTimer);
    };
  }, [rollKey, rollStartedAt, hasResult, reducedMotion]);

  const d20Highlight = useMemo(() => {
    if (stage !== 'revealed' || !overlay?.result) return null;
    for (let i = 0; i < overlay.dice.length; i += 1) {
      if (overlay.dice[i]?.faces === 20) {
        const val = overlay.result.dice[i];
        if (val === 20) return 'crit';
        if (val === 1) return 'fumble';
      }
    }
    return null;
  }, [stage, overlay]);

  if (!overlay) return null;

  const isLockedOutcome = stage === 'settling' || stage === 'revealed' || stage === 'fading';
  const showResult = stage === 'revealed' || stage === 'fading';
  const trimmedAssistantName = assistantName?.trim();
  const titleText =
    overlay.by === 'assistant' && trimmedAssistantName
      ? `${trimmedAssistantName} · ${overlay.expr}`
      : overlay.expr;

  return (
    <div
      className={`app-toy-roll-overlay app-toy-roll-overlay--${stage}${
        d20Highlight ? ` app-toy-roll-overlay--${d20Highlight}` : ''
      }`}
      role="status"
      aria-live="polite"
      aria-label={`掷骰 ${overlay.expr}${showResult && overlay.result ? `，结果 ${overlay.result.total}` : '，掷骰中'}`}
      data-roll-phase={stage}
    >
      <div
        className={`app-toy-roll-card${stage === 'revealed' ? ' app-toy-roll-card--dismissible' : ''}`}
        title={stage === 'revealed' ? '点击收起' : undefined}
        onClick={() => {
          if (stage === 'revealed') {
            onDismiss(overlay.rollKey);
          }
        }}
      >
        <div className="app-toy-roll-head">
          <span className="app-toy-roll-expr">{titleText}</span>
          <span className="app-toy-roll-status">
            {showResult ? '掷骰落定 · 点击收起' : stage === 'settling' ? '定格中…' : '掷骰中…'}
          </span>
          <button
            type="button"
            className="app-toy-roll-close"
            aria-label="收起掷骰浮层"
            title="收起"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(overlay.rollKey);
            }}
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>

        <div className="app-toy-roll-dice">
          {overlay.dice.map((die, idx) => {
            const val = isLockedOutcome && overlay.result ? (overlay.result.dice[idx] ?? die.faces) : die.faces;
            const highlight =
              showResult && die.faces === 20 && val === 20
                ? 'crit'
                : showResult && die.faces === 20 && val === 1
                  ? 'fumble'
                  : null;
            return (
              <div
                key={die.id}
                ref={(el) => {
                  if (el) {
                    slotRefs.current.set(die.id, el);
                  } else {
                    slotRefs.current.delete(die.id);
                  }
                }}
                className="app-toy-roll-die-slot"
              >
                <DieSvg faces={die.faces} label={val} size={44} angleRad={0} highlight={highlight} />
              </div>
            );
          })}
        </div>

        {showResult && overlay.result ? (
          <div className="app-toy-roll-summary" data-testid="dice-roll-result-summary">
            <span className="app-toy-roll-breakdown">
              [{overlay.result.dice.join(', ')}]
              {overlay.modifier !== 0
                ? overlay.modifier > 0
                  ? ` + ${overlay.modifier}`
                  : ` - ${Math.abs(overlay.modifier)}`
                : ''}
            </span>
            <strong className="app-toy-roll-total">= {overlay.result.total}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
}
