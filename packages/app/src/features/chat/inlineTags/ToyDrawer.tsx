import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { Dices, RotateCcw, Smartphone, StickyNote, X } from 'lucide-react';
import { DICE_FACES, MAX_DICE } from './parse';
import {
  MAX_DICE_MODIFIER,
  MIN_DICE_MODIFIER,
  fontSizeForDieLabel,
  formatDiceExpr,
  type DieFaces,
} from './diceTypes';
import {
  applyPointerSweep,
  applyTrayImpulse,
  stepDiceWorld,
  type PhysicsDie,
  type TrayBounds,
} from './dicePhysics';
import { DieSvg } from './DiceRenderer';
import {
  PIN_COLOR_PRESETS,
  hasUnsafePinClose,
  type DraftPin,
  type PinColor,
} from './pinColors';

export type ToyTab = 'dice' | 'pin';

export interface PinDraftEditorState {
  editingDraftId: string | null;
  body: string;
  color: PinColor;
}

export interface ToyDrawerProps {
  open: boolean;
  disabled: boolean;
  activeTab: ToyTab;
  onSelectTab: (tab: ToyTab) => void;
  onClose: () => void;
  /** Live tray dice bodies & modifier owned by `useComposerToys`. */
  physicsDice: readonly PhysicsDie[];
  onSetPhysicsDice: (updater: (prev: PhysicsDie[]) => PhysicsDie[]) => void;
  onAddDie: (faces: DieFaces, spawn?: { x?: number; y?: number; vx?: number; vy?: number }) => void;
  onRemoveDie: (id: string) => void;
  onClearDice: () => void;
  modifier: number;
  onChangeModifier: (next: number) => void;
  /** Pin WYSIWYG editor state. */
  pinEditor: PinDraftEditorState;
  onChangePinEditor: (next: PinDraftEditorState) => void;
  onCommitPinEditor: () => { ok: true } | { ok: false; error: string };
  onDiscardPinEditor: () => void;
  draftPins: readonly DraftPin[];
  toggleButtonRef?: RefObject<HTMLButtonElement | null>;
  onTrayBoundsChange?: (bounds: TrayBounds) => void;
}

type DeviceMotionStatic = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

interface TrayRectSnapshot {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const DEFAULT_TRAY_BOUNDS: TrayBounds = { width: 320, height: 156, padding: 10 };

function clampNum(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function toRectSnapshot(rect: DOMRect): TrayRectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function computeTraySnap(rect: TrayRectSnapshot | null, clientX: number, clientY: number) {
  if (!rect) return { insideMagnet: false, localX: 0, localY: 0 };
  const margin = 24;
  const insideMagnet =
    clientX >= rect.left - margin &&
    clientX <= rect.right + margin &&
    clientY >= rect.top - margin &&
    clientY <= rect.bottom + margin;
  return {
    insideMagnet,
    localX: clampNum(clientX - rect.left, 16, Math.max(16, rect.width - 16)),
    localY: clampNum(clientY - rect.top, 16, Math.max(16, rect.height - 16)),
  };
}

function updateGhostDom(
  ghost: HTMLDivElement | null,
  x: number,
  y: number,
  visible: boolean,
  isTouch: boolean,
) {
  if (!ghost) return;
  if (!visible) {
    ghost.style.opacity = '0';
    ghost.style.transform = 'translate3d(-9999px, -9999px, 0) translate(-50%, -50%) scale(1.16)';
    return;
  }
  const offsetY = isTouch ? -18 : 0;
  ghost.style.opacity = '1';
  ghost.style.transform = `translate3d(${x.toFixed(1)}px, ${(y + offsetY).toFixed(1)}px, 0) translate(-50%, -50%) scale(1.16)`;
}

export function ToyDrawer({
  open,
  disabled,
  activeTab,
  onSelectTab,
  onClose,
  physicsDice,
  onSetPhysicsDice,
  onAddDie,
  onRemoveDie,
  onClearDice,
  modifier,
  onChangeModifier,
  pinEditor,
  onChangePinEditor,
  onCommitPinEditor,
  onDiscardPinEditor,
  draftPins,
  toggleButtonRef,
  onTrayBoundsChange,
}: ToyDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const trayRectRef = useRef<TrayRectSnapshot | null>(null);
  const pinEditorRef = useRef<HTMLDivElement | null>(null);
  const pinTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const [trayBounds, setTrayBounds] = useState<TrayBounds>(DEFAULT_TRAY_BOUNDS);
  const [poolLimitNotice, setPoolLimitNotice] = useState(false);
  const [magnetActive, setMagnetActive] = useState(false);
  const [draggingPoolFaces, setDraggingPoolFaces] = useState<DieFaces | null>(null);
  const [trayGestureActive, setTrayGestureActive] = useState(false);
  const [allSettledVisual, setAllSettledVisual] = useState(
    () => physicsDice.length > 0 && physicsDice.every((d) => d.settled),
  );
  const [spaceRattling, setSpaceRattling] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // DeviceMotion availability + iOS explicit permission handling
  const hasDeviceMotion = typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  const needsMotionPermission =
    hasDeviceMotion && typeof (window.DeviceMotionEvent as DeviceMotionStatic)?.requestPermission === 'function';
  const [motionEnabled, setMotionEnabled] = useState<boolean>(() => hasDeviceMotion && !needsMotionPermission);

  const suppressNextPoolClickRef = useRef(false);
  const suppressNextDieClickRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const poolDragRef = useRef<{
    faces: DieFaces;
    pointerType: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    accumDx: number;
    accumDy: number;
    lastImpulseT: number;
    sweepX: number;
    sweepY: number;
    sweepT: number;
  } | null>(null);
  const trayDieDragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const lastMotionRef = useRef<{ x: number; y: number; z: number } | null>(null);

  const dieBtnMapRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastDomLabelRef = useRef<Map<string, number>>(new Map());
  const simDiceRef = useRef<PhysicsDie[]>(physicsDice as PhysicsDie[]);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef<number>(0);

  const boundsRef = useRef(trayBounds);
  boundsRef.current = trayBounds;
  const isDiceVisibleRef = useRef(open && !disabled && activeTab === 'dice');
  isDiceVisibleRef.current = open && !disabled && activeTab === 'dice';

  const formattedExpr = useMemo(() => formatDiceExpr(physicsDice, modifier), [physicsDice, modifier]);

  const snapshotTrayRect = useCallback((): TrayRectSnapshot | null => {
    const tray = trayRef.current;
    if (!tray) {
      trayRectRef.current = null;
      return null;
    }
    const snap = toRectSnapshot(tray.getBoundingClientRect());
    trayRectRef.current = snap;
    return snap;
  }, []);

  const applyDiceToDom = useCallback((dice: readonly PhysicsDie[]) => {
    for (const d of dice) {
      const btn = dieBtnMapRef.current.get(d.id);
      if (!btn) continue;
      btn.style.transform = `translate3d(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px, 0) translate(-50%, -50%)`;
      const svg = btn.firstElementChild as SVGSVGElement | null;
      if (svg) {
        svg.style.transform = d.angle !== 0 ? `rotate(${d.angle.toFixed(4)}rad)` : '';
        if (lastDomLabelRef.current.get(d.id) !== d.previewValue) {
          lastDomLabelRef.current.set(d.id, d.previewValue);
          const textEl = svg.querySelector('text');
          if (textEl) {
            const textStr = String(d.previewValue);
            textEl.textContent = textStr;
            textEl.setAttribute('font-size', fontSizeForDieLabel(textStr));
          }
        }
      }
    }
  }, []);

  const flushSettledToParent = useCallback(
    (settledDice: readonly PhysicsDie[]) => {
      const byId = new Map(settledDice.map((d) => [d.id, d]));
      onSetPhysicsDice((prev) => {
        let changed = false;
        const next = prev.map((d) => {
          const fin = byId.get(d.id);
          if (!fin) return d;
          if (
            d.settled &&
            d.x === fin.x &&
            d.y === fin.y &&
            d.angle === fin.angle &&
            d.previewValue === fin.previewValue
          ) {
            return d;
          }
          changed = true;
          return {
            ...d,
            x: fin.x,
            y: fin.y,
            vx: 0,
            vy: 0,
            angle: fin.angle,
            angularVel: 0,
            previewValue: fin.previewValue,
            settled: true,
          };
        });
        return changed ? next : prev;
      });
    },
    [onSetPhysicsDice],
  );

  const kickPhysicsLoop = useCallback(() => {
    if (!isDiceVisibleRef.current) return;
    if (simDiceRef.current.every((d) => d.settled)) return;

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const settled = simDiceRef.current.map((d) => ({ ...d, vx: 0, vy: 0, angularVel: 0, settled: true }));
      simDiceRef.current = settled;
      applyDiceToDom(settled);
      setAllSettledVisual(settled.length > 0);
      flushSettledToParent(settled);
      return;
    }

    setAllSettledVisual(false);
    if (rafIdRef.current !== null) return;

    lastFrameTsRef.current = performance.now();
    const tick = (now: number) => {
      rafIdRef.current = null;
      if (!isDiceVisibleRef.current) return;
      const dt = (now - lastFrameTsRef.current) / 1000;
      lastFrameTsRef.current = now;
      const next = stepDiceWorld(simDiceRef.current, boundsRef.current, dt);
      simDiceRef.current = next;
      applyDiceToDom(next);
      const anyMoving = next.some((d) => !d.settled);
      if (anyMoving) {
        rafIdRef.current = window.requestAnimationFrame(tick);
      } else {
        setAllSettledVisual(next.length > 0);
        flushSettledToParent(next);
      }
    };
    rafIdRef.current = window.requestAnimationFrame(tick);
  }, [applyDiceToDom, flushSettledToParent]);

  // Reconcile structural dice additions/removals into simulation ref and apply DOM transforms
  useLayoutEffect(() => {
    const liveById = new Map(simDiceRef.current.map((d) => [d.id, d]));
    const activeIds = new Set<string>();
    const merged: PhysicsDie[] = physicsDice.map((propDie) => {
      activeIds.add(propDie.id);
      return liveById.get(propDie.id) ?? propDie;
    });
    simDiceRef.current = merged;

    for (const key of Array.from(lastDomLabelRef.current.keys())) {
      if (!activeIds.has(key)) lastDomLabelRef.current.delete(key);
    }

    const nextSettled = merged.length > 0 && merged.every((d) => d.settled);
    setAllSettledVisual((prev) => (prev === nextSettled ? prev : nextSettled));

    if (open && !disabled && activeTab === 'dice') {
      applyDiceToDom(merged);
      if (!nextSettled && merged.length > 0) {
        kickPhysicsLoop();
      }
    } else if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, [physicsDice, open, disabled, activeTab, applyDiceToDom, kickPhysicsLoop]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Measure tray bounds when open on dice tab
  useEffect(() => {
    if (!open || activeTab !== 'dice') return undefined;
    const el = trayRef.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      trayRectRef.current = toRectSnapshot(rect);
      if (rect.width > 40 && rect.height > 40) {
        const next = { width: rect.width, height: rect.height, padding: 10 };
        setTrayBounds(next);
        onTrayBoundsChange?.(next);
      }
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      trayRectRef.current = null;
    };
  }, [open, activeTab, onTrayBoundsChange]);

  // Continuous gentle rattle while Space is held on tray focus (DOM-only per tick)
  useEffect(() => {
    if (!spaceRattling || !open || activeTab !== 'dice') return undefined;
    const trayEl = trayRef.current;
    const timer = window.setInterval(() => {
      simDiceRef.current = applyTrayImpulse(
        simDiceRef.current,
        (Math.random() - 0.5) * 320,
        (Math.random() - 0.5) * 280,
        210,
      );
      if (trayEl) {
        const ox = (Math.random() - 0.5) * 6;
        const oy = (Math.random() - 0.5) * 5;
        trayEl.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;
      }
      kickPhysicsLoop();
    }, 75);
    return () => {
      window.clearInterval(timer);
      if (trayEl) {
        trayEl.style.transform = '';
      }
    };
  }, [spaceRattling, open, activeTab, kickPhysicsLoop]);

  // DeviceMotion shake channel with graceful silent fallback
  useEffect(() => {
    if (!open || activeTab !== 'dice' || !motionEnabled || !hasDeviceMotion) return undefined;
    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acc || acc.x === null || acc.y === null) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;
      const prev = lastMotionRef.current;
      lastMotionRef.current = { x, y, z };
      if (!prev) return;
      const dx = x - prev.x;
      const dy = y - prev.y;
      const dz = z - prev.z;
      const mag = Math.hypot(dx, dy, dz);
      if (mag > 4.2 && simDiceRef.current.length > 0) {
        simDiceRef.current = applyTrayImpulse(
          simDiceRef.current,
          dx * 28,
          -dy * 28,
          Math.min(260, mag * 24),
        );
        kickPhysicsLoop();
      }
    };
    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [open, activeTab, motionEnabled, hasDeviceMotion, kickPhysicsLoop]);

  // Auto-focus textarea when switching to Pin tab or editing a draft note
  useEffect(() => {
    if (open && activeTab === 'pin') {
      setPinError(null);
      window.requestAnimationFrame(() => pinTextareaRef.current?.focus());
    }
  }, [open, activeTab, pinEditor.editingDraftId]);

  const attemptPinCommit = useCallback((): boolean => {
    if (pinEditor.body.trim().length === 0) {
      setPinError(null);
      return true;
    }
    const res = onCommitPinEditor();
    if (!res.ok) {
      setPinError(res.error);
      pinTextareaRef.current?.focus();
      return false;
    }
    setPinError(null);
    return true;
  }, [pinEditor.body, onCommitPinEditor]);

  useEffect(() => {
    if (!open || activeTab !== 'pin') return undefined;
    const handleOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (pinEditorRef.current?.contains(target)) return;
      if (drawerRef.current?.contains(target)) return;
      if (toggleButtonRef?.current?.contains(target)) return;
      attemptPinCommit();
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [open, activeTab, attemptPinCommit, toggleButtonRef]);

  // Dragging a die from the pool into the tray with 24px magnetic edge snap (ref-driven 60fps ghost)
  useEffect(() => {
    if (draggingPoolFaces === null) return undefined;

    const getRect = () => trayRectRef.current ?? snapshotTrayRect();

    const handleMove = (e: PointerEvent) => {
      const drag = poolDragRef.current;
      if (!drag) return;
      const now = performance.now();
      const dt = Math.max(0.008, (now - drag.lastT) / 1000);
      drag.vx = clampNum((e.clientX - drag.lastX) / dt, -900, 900);
      drag.vy = clampNum((e.clientY - drag.lastY) / dt, -900, 900);
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      drag.lastT = now;

      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 6) {
        drag.moved = true;
      }

      updateGhostDom(dragGhostRef.current, e.clientX, e.clientY, drag.moved, drag.pointerType === 'touch');

      const nextMagnet = drag.moved && computeTraySnap(getRect(), e.clientX, e.clientY).insideMagnet;
      setMagnetActive((prev) => (prev === nextMagnet ? prev : nextMagnet));
    };

    const cleanup = () => {
      poolDragRef.current = null;
      updateGhostDom(dragGhostRef.current, 0, 0, false, false);
      setDraggingPoolFaces(null);
      setMagnetActive(false);
    };

    const handleUp = (e: PointerEvent) => {
      const drag = poolDragRef.current;
      if (!drag) {
        cleanup();
        return;
      }
      const distMoved = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      const wasDrag = drag.moved || distMoved >= 6;
      if (wasDrag) {
        suppressNextPoolClickRef.current = true;
        const snap = computeTraySnap(getRect(), e.clientX, e.clientY);
        if (snap.insideMagnet) {
          if (simDiceRef.current.length >= MAX_DICE) {
            setPoolLimitNotice(true);
          } else {
            setPoolLimitNotice(false);
            const hasThrow = Math.hypot(drag.vx, drag.vy) > 40;
            onAddDie(drag.faces, {
              x: snap.localX,
              y: snap.localY,
              vx: hasThrow ? clampNum(drag.vx * 0.45, -260, 260) : (Math.random() - 0.5) * 140,
              vy: hasThrow ? clampNum(drag.vy * 0.45, -240, 260) : 45 + Math.random() * 80,
            });
          }
        }
      }
      cleanup();
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', cleanup);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', cleanup);
    };
  }, [draggingPoolFaces, onAddDie, snapshotTrayRect]);

  // Global drag tracking for tray die repositioning/drag-out and tray pan-flick (DOM-first, zero layout thrash)
  useEffect(() => {
    if (!trayGestureActive) return undefined;

    const getRect = () => trayRectRef.current ?? snapshotTrayRect();

    const handleMove = (e: PointerEvent) => {
      const tray = trayRef.current;
      const rect = getRect();
      if (!tray || !rect) return;

      if (trayDieDragRef.current) {
        const drag = trayDieDragRef.current;
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const now = performance.now();
        const dt = Math.max(0.008, (now - drag.lastT) / 1000);
        drag.vx = clampNum((e.clientX - drag.lastX) / dt, -1000, 1000);
        drag.vy = clampNum((e.clientY - drag.lastY) / dt, -1000, 1000);
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        drag.lastT = now;

        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) >= 6) {
          drag.moved = true;
        }
        if (drag.moved) {
          simDiceRef.current = simDiceRef.current.map((d) =>
            d.id === drag.id
              ? { ...d, x: localX, y: localY, vx: 0, vy: 0, settled: false }
              : d,
          );
          applyDiceToDom(simDiceRef.current);
          setAllSettledVisual(false);
        }
        return;
      }

      if (panDragRef.current) {
        const pan = panDragRef.current;
        const now = performance.now();
        const dx = e.clientX - pan.lastX;
        const dy = e.clientY - pan.lastY;
        pan.lastX = e.clientX;
        pan.lastY = e.clientY;
        pan.lastT = now;
        pan.accumDx += dx;
        pan.accumDy += dy;

        const ox = clampNum((e.clientX - pan.startX) * 0.22, -8, 8);
        const oy = clampNum((e.clientY - pan.startY) * 0.22, -8, 8);
        tray.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;

        if (simDiceRef.current.length > 0) {
          const localX = e.clientX - rect.left;
          const localY = e.clientY - rect.top;

          // Direct finger sweep near any die (mirrors desktop cursor poke without ignoring 120Hz micro-deltas)
          if (Math.hypot(localX - pan.sweepX, localY - pan.sweepY) >= 2) {
            const sweepDt = Math.max(0.008, (now - pan.sweepT) / 1000);
            const swept = applyPointerSweep(
              simDiceRef.current,
              pan.sweepX,
              pan.sweepY,
              localX,
              localY,
              sweepDt,
            );
            pan.sweepX = localX;
            pan.sweepY = localY;
            pan.sweepT = now;
            if (swept !== simDiceRef.current) {
              simDiceRef.current = swept;
              kickPhysicsLoop();
            }
          }

          // Batched ~60fps tray shake impulse so 120Hz mobile swipes feel responsive without jitter churn
          if (now - pan.lastImpulseT >= 16 && Math.hypot(pan.accumDx, pan.accumDy) >= 2) {
            const winDt = Math.max(0.012, (now - pan.lastImpulseT) / 1000);
            const vx = clampNum((pan.accumDx / winDt) * 0.34, -360, 360);
            const vy = clampNum((pan.accumDy / winDt) * 0.34, -360, 360);
            const speed = Math.hypot(pan.accumDx, pan.accumDy) / winDt;
            simDiceRef.current = applyTrayImpulse(
              simDiceRef.current,
              vx,
              vy,
              Math.min(200, Math.max(70, speed * 0.22)),
            );
            pan.accumDx = 0;
            pan.accumDy = 0;
            pan.lastImpulseT = now;
            kickPhysicsLoop();
          }
        }
      }
    };

    const cleanup = () => {
      trayDieDragRef.current = null;
      panDragRef.current = null;
      if (trayRef.current) {
        trayRef.current.style.transform = '';
      }
      setTrayGestureActive(false);
    };

    const finishTrayDrags = (e: PointerEvent) => {
      if (trayDieDragRef.current) {
        const drag = trayDieDragRef.current;
        trayDieDragRef.current = null;
        if (drag.moved) {
          suppressNextDieClickRef.current = true;
          const rect = getRect();
          const outside =
            rect !== null &&
            (e.clientX < rect.left - 12 ||
              e.clientX > rect.right + 12 ||
              e.clientY < rect.top - 12 ||
              e.clientY > rect.bottom + 12);
          if (outside) {
            onRemoveDie(drag.id);
          } else {
            simDiceRef.current = simDiceRef.current.map((d) =>
              d.id === drag.id
                ? {
                    ...d,
                    vx: clampNum(drag.vx * 0.55, -360, 360),
                    vy: clampNum(drag.vy * 0.55, -320, 320),
                    angularVel: (drag.vx - drag.vy) * 0.015,
                    settled: false,
                  }
                : d,
            );
            kickPhysicsLoop();
          }
        }
      }
      panDragRef.current = null;
      if (trayRef.current) {
        trayRef.current.style.transform = '';
      }
      setTrayGestureActive(false);
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', finishTrayDrags);
    window.addEventListener('pointercancel', cleanup);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', finishTrayDrags);
      window.removeEventListener('pointercancel', cleanup);
    };
  }, [trayGestureActive, onRemoveDie, applyDiceToDom, kickPhysicsLoop, snapshotTrayRect]);

  if (!open || disabled) return null;

  const handleCloseDrawer = () => {
    if (activeTab === 'pin' && !attemptPinCommit()) return;
    onClose();
  };

  const handleSwitchTab = (tab: ToyTab) => {
    if (tab === activeTab) return;
    if (activeTab === 'pin' && !attemptPinCommit()) return;
    onSelectTab(tab);
  };

  const handlePoolClick = (faces: DieFaces) => {
    if (suppressNextPoolClickRef.current) {
      suppressNextPoolClickRef.current = false;
      return;
    }
    if (simDiceRef.current.length >= MAX_DICE) {
      setPoolLimitNotice(true);
      return;
    }
    setPoolLimitNotice(false);
    onAddDie(faces);
  };

  const handleEnableMotion = async () => {
    const dm = window.DeviceMotionEvent as DeviceMotionStatic | undefined;
    if (!dm?.requestPermission) {
      setMotionEnabled(true);
      return;
    }
    try {
      const perm = await dm.requestPermission();
      setMotionEnabled(perm === 'granted');
    } catch {
      setMotionEnabled(false);
    }
  };

  const handleTrayPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.app-toy-tray-die')) return;
    const rect = snapshotTrayRect();
    trayRef.current?.focus();
    const now = performance.now();
    panDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: now,
      accumDx: 0,
      accumDy: 0,
      lastImpulseT: now,
      sweepX: rect ? e.clientX - rect.left : 0,
      sweepY: rect ? e.clientY - rect.top : 0,
      sweepT: now,
    };
    setTrayGestureActive(true);
  };

  const handleTrayHoverMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || trayGestureActive || poolDragRef.current) return;
    if (simDiceRef.current.length === 0) return;
    const rect = trayRectRef.current ?? snapshotTrayRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;
    const prevPtr = lastPointerRef.current;
    const now = performance.now();
    if (!prevPtr) {
      lastPointerRef.current = { x: localX, y: localY, t: now };
      return;
    }
    if (Math.hypot(localX - prevPtr.x, localY - prevPtr.y) < 2) return;
    const dt = (now - prevPtr.t) / 1000;
    lastPointerRef.current = { x: localX, y: localY, t: now };
    const swept = applyPointerSweep(simDiceRef.current, prevPtr.x, prevPtr.y, localX, localY, dt);
    if (swept !== simDiceRef.current) {
      simDiceRef.current = swept;
      kickPhysicsLoop();
    }
  };

  return (
    <section
      ref={drawerRef}
      className="app-toy-drawer"
      aria-label="游乐小抽屉"
      data-toy-drawer="open"
    >
      <header className="app-toy-drawer-head">
        <div className="app-toy-drawer-tabs" role="tablist" aria-label="游乐工具切换">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'dice'}
            className={`app-toy-tab${activeTab === 'dice' ? ' app-toy-tab--active' : ''}`}
            onClick={() => handleSwitchTab('dice')}
          >
            <Dices size={14} aria-hidden="true" />
            <span>骰盘</span>
            {physicsDice.length > 0 ? <em className="app-toy-tab-count">{physicsDice.length}</em> : null}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'pin'}
            className={`app-toy-tab${activeTab === 'pin' ? ' app-toy-tab--active' : ''}`}
            onClick={() => handleSwitchTab('pin')}
          >
            <StickyNote size={14} aria-hidden="true" />
            <span>便利贴</span>
            {draftPins.length > 0 ? <em className="app-toy-tab-count">{draftPins.length}</em> : null}
          </button>
        </div>

        <button
          type="button"
          className="app-toy-drawer-close"
          onClick={handleCloseDrawer}
          aria-label="合上小抽屉"
          title="合上小抽屉"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      {activeTab === 'dice' ? (
        <div className="app-toy-dice-panel" role="tabpanel" aria-label="可爱骰盘">
          <div className="app-toy-dice-pool" aria-label="骰子池">
            {DICE_FACES.map((faces) => {
              const atLimit = physicsDice.length >= MAX_DICE;
              const pressing = draggingPoolFaces === faces;
              return (
                <button
                  key={faces}
                  type="button"
                  className={`app-toy-pool-btn${faces === 20 ? ' app-toy-pool-btn--hero' : ''}${
                    pressing ? ' app-toy-pool-btn--pressing' : ''
                  }`}
                  disabled={atLimit}
                  aria-label={`添加 d${faces}`}
                  title={atLimit ? `单次最多掷 ${MAX_DICE} 颗骰子` : `点击或拖入 d${faces}`}
                  onPointerDown={(e) => {
                    if (atLimit || (e.pointerType === 'mouse' && e.button !== 0)) return;
                    snapshotTrayRect();
                    const now = performance.now();
                    poolDragRef.current = {
                      faces,
                      pointerType: e.pointerType,
                      startX: e.clientX,
                      startY: e.clientY,
                      lastX: e.clientX,
                      lastY: e.clientY,
                      lastT: now,
                      vx: 0,
                      vy: 0,
                      moved: false,
                    };
                    setDraggingPoolFaces(faces);
                  }}
                  onClick={() => handlePoolClick(faces)}
                >
                  <DieSvg faces={faces} label={`d${faces}`} size={28} />
                </button>
              );
            })}
            <span className="app-toy-pool-meta" title="上限 8 颗">
              {physicsDice.length}/{MAX_DICE}
            </span>
          </div>

          {poolLimitNotice || physicsDice.length >= MAX_DICE ? (
            <p className="app-toy-limit-hint" role="status">
              单次最多掷 {MAX_DICE} 颗骰子
            </p>
          ) : null}

          <div
            ref={trayRef}
            tabIndex={0}
            role="application"
            aria-label="把玩骰盘区：长按 Space 摇晃，点击骰子撤回"
            className={`app-toy-tray${magnetActive ? ' app-toy-tray--magnet' : ''}${
              spaceRattling ? ' app-toy-tray--shaking' : ''
            }`}
            onPointerEnter={() => snapshotTrayRect()}
            onPointerDown={handleTrayPointerDown}
            onPointerMove={handleTrayHoverMove}
            onPointerLeave={() => {
              lastPointerRef.current = null;
              if (!trayGestureActive) trayRectRef.current = null;
            }}
            onKeyDown={(e) => {
              if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                setSpaceRattling(true);
                simDiceRef.current = applyTrayImpulse(
                  simDiceRef.current,
                  (Math.random() - 0.5) * 320,
                  (Math.random() - 0.5) * 260,
                  220,
                );
                kickPhysicsLoop();
              } else if (e.code === 'Space') {
                e.preventDefault();
              }
            }}
            onKeyUp={(e) => {
              if (e.code === 'Space') {
                setSpaceRattling(false);
              }
            }}
            onBlur={() => setSpaceRattling(false)}
          >
            {physicsDice.length === 0 ? (
              <div className="app-toy-tray-empty">点击或拖入上方宝石骰子</div>
            ) : (
              physicsDice.map((die) => (
                <button
                  key={die.id}
                  ref={(el) => {
                    if (el) {
                      dieBtnMapRef.current.set(die.id, el);
                    } else {
                      dieBtnMapRef.current.delete(die.id);
                    }
                  }}
                  type="button"
                  className="app-toy-tray-die"
                  aria-label={`d${die.faces} 试滚预览 ${die.previewValue}，点击撤回`}
                  title={`d${die.faces} · 点击或拖出盘外撤回`}
                  style={{
                    width: `${die.radius * 2}px`,
                    height: `${die.radius * 2}px`,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    snapshotTrayRect();
                    const now = performance.now();
                    trayDieDragRef.current = {
                      id: die.id,
                      startX: e.clientX,
                      startY: e.clientY,
                      lastX: e.clientX,
                      lastY: e.clientY,
                      lastT: now,
                      vx: 0,
                      vy: 0,
                      moved: false,
                    };
                    setTrayGestureActive(true);
                  }}
                  onClick={() => {
                    if (suppressNextDieClickRef.current) {
                      suppressNextDieClickRef.current = false;
                      return;
                    }
                    onRemoveDie(die.id);
                  }}
                >
                  <DieSvg faces={die.faces} label={die.previewValue} size={die.radius * 2} angleRad={die.angle} />
                </button>
              ))
            )}
            {allSettledVisual ? (
              <span className="app-toy-tray-watermark" aria-hidden="true">
                试滚中 · 发送后正式掷骰
              </span>
            ) : null}
          </div>

          <div className="app-toy-dice-controls">
            <div className="app-toy-modifier" aria-label="常数修正">
              <span className="app-toy-modifier-label">修正</span>
              <button
                type="button"
                className="app-toy-step-btn"
                aria-label="减小修正值"
                disabled={modifier <= MIN_DICE_MODIFIER}
                onClick={() => onChangeModifier(modifier - 1)}
              >
                -
              </button>
              <span className="app-toy-modifier-val" data-testid="dice-modifier-val">
                {modifier === 0 ? '±0' : modifier > 0 ? `+${modifier}` : String(modifier)}
              </span>
              <button
                type="button"
                className="app-toy-step-btn"
                aria-label="增大修正值"
                disabled={modifier >= MAX_DICE_MODIFIER}
                onClick={() => onChangeModifier(modifier + 1)}
              >
                +
              </button>
            </div>

            <div className="app-toy-dice-actions">
              <button
                type="button"
                className="app-toy-action-btn"
                disabled={physicsDice.length === 0}
                title="轻晃骰盘（或长按 Space）"
                onClick={() => {
                  simDiceRef.current = applyTrayImpulse(
                    simDiceRef.current,
                    (Math.random() - 0.5) * 380,
                    (Math.random() - 0.5) * 320,
                    240,
                  );
                  kickPhysicsLoop();
                }}
              >
                晃一晃
              </button>
              {needsMotionPermission && !motionEnabled ? (
                <button
                  type="button"
                  className="app-toy-action-btn"
                  title="开启手机摇一摇重力感应"
                  onClick={handleEnableMotion}
                >
                  <Smartphone size={12} aria-hidden="true" />
                  <span>启用摇一摇</span>
                </button>
              ) : null}
              <button
                type="button"
                className="app-toy-action-btn"
                disabled={physicsDice.length === 0 && modifier === 0}
                onClick={() => {
                  setPoolLimitNotice(false);
                  onClearDice();
                }}
                aria-label="清空骰盘"
                title="清空骰盘"
              >
                <RotateCcw size={12} aria-hidden="true" />
                <span>清空</span>
              </button>
            </div>
          </div>

          <div className="app-toy-dice-footer">
            <span className="app-toy-dice-expr">
              {formattedExpr ? `待发骰式：${formattedExpr}` : '尚未装骰'}
            </span>
            <span className="app-toy-dice-hint">光标拨弄 · 拖框甩盘 · 长按 Space 摇晃</span>
          </div>

          {draggingPoolFaces !== null ? (
            <div
              ref={dragGhostRef}
              className="app-toy-drag-ghost"
              style={{ opacity: 0 }}
              aria-hidden="true"
            >
              <DieSvg faces={draggingPoolFaces} label={`d${draggingPoolFaces}`} size={40} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="app-toy-pin-panel" role="tabpanel" aria-label="多色便利贴草稿">
          <div ref={pinEditorRef} className="app-toy-pin-editor">
            <div className="app-itag-note app-toy-pin-sheet" data-pin-color={pinEditor.color}>
              <div className="app-toy-pin-sheet-head">
                <span className="app-itag-note-badge">
                  {pinEditor.editingDraftId ? '编辑待发便签' : '新建便利贴'}
                </span>
              </div>
              <textarea
                ref={pinTextareaRef}
                className="app-toy-pin-textarea"
                rows={3}
                placeholder="直接写在便利贴上，点击纸片外部即吸顶待发…"
                value={pinEditor.body}
                onChange={(e) => {
                  const nextBody = e.target.value;
                  if (pinError && !hasUnsafePinClose(nextBody)) setPinError(null);
                  onChangePinEditor({ ...pinEditor, body: nextBody });
                }}
              />
              <div className="app-toy-pin-palette" role="group" aria-label="选择便利贴颜色">
                {PIN_COLOR_PRESETS.map((preset) => {
                  const selected = pinEditor.color === preset.color;
                  return (
                    <button
                      key={preset.color}
                      type="button"
                      className={`app-toy-swatch${selected ? ' app-toy-swatch--selected' : ''}`}
                      style={{ backgroundColor: preset.swatch }}
                      aria-label={`便签颜色：${preset.label}`}
                      aria-pressed={selected}
                      title={preset.label}
                      onClick={() => onChangePinEditor({ ...pinEditor, color: preset.color })}
                    />
                  );
                })}
              </div>
              {pinError ? (
                <p className="app-toy-pin-error" role="alert">
                  {pinError}
                </p>
              ) : null}
              <div className="app-toy-pin-actions">
                <button
                  type="button"
                  className="app-toy-pin-action-btn"
                  onClick={() => {
                    setPinError(null);
                    onDiscardPinEditor();
                  }}
                >
                  放弃
                </button>
                <button
                  type="button"
                  className="app-toy-pin-action-btn app-toy-pin-action-btn--primary"
                  disabled={pinEditor.body.trim().length === 0}
                  onClick={() => {
                    attemptPinCommit();
                  }}
                >
                  完成贴上
                </button>
              </div>
            </div>
          </div>
          <p className="app-toy-pin-tip">贴上后会吸顶至右上角便利贴区预览，随下条消息一同发出。</p>
        </div>
      )}
    </section>
  );
}
