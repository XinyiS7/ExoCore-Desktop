import type { DieFaces } from './diceTypes';

export interface TrayBounds {
  width: number;
  height: number;
  padding: number;
}

export interface PhysicsDie {
  id: string;
  faces: DieFaces;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  angularVel: number;
  radius: number;
  previewValue: number;
  settled: boolean;
}

const MAX_DT = 0.032;
const WALL_RESTITUTION = 0.58;
const DIE_RESTITUTION = 0.65;
const STOP_SPEED = 8;
const STOP_ANGULAR = 0.15;

export function dieRadiusForFaces(faces: DieFaces): number {
  return faces === 20 || faces === 100 ? 22 : 19;
}

export function randomDieFace(faces: DieFaces): number {
  return Math.floor(Math.random() * faces) + 1;
}

function clampCoord(val: number, min: number, max: number): number {
  if (min >= max) return (min + max) / 2;
  return Math.max(min, Math.min(max, val));
}

export function createPhysicsDie(
  id: string,
  faces: DieFaces,
  bounds: TrayBounds,
  spawn?: { x?: number; y?: number; vx?: number; vy?: number },
): PhysicsDie {
  const radius = dieRadiusForFaces(faces);
  const minX = bounds.padding + radius;
  const maxX = Math.max(minX, bounds.width - bounds.padding - radius);
  const minY = bounds.padding + radius;
  const maxY = Math.max(minY, bounds.height - bounds.padding - radius);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const x = clampCoord(spawn?.x ?? cx + (Math.random() - 0.5) * 38, minX, maxX);
  const y = clampCoord(spawn?.y ?? cy + (Math.random() - 0.5) * 28, minY, maxY);

  return {
    id,
    faces,
    x,
    y,
    vx: spawn?.vx ?? (Math.random() - 0.5) * 190,
    vy: spawn?.vy ?? (Math.random() - 0.5) * 150 - 30,
    angle: (Math.random() - 0.5) * 0.8,
    angularVel: (Math.random() - 0.5) * 9,
    radius,
    previewValue: randomDieFace(faces),
    settled: false,
  };
}

/**
 * Advances the 2D velvet-tray rigid-body simulation by one clamped frame.
 * Returns the original array reference if every die is already settled.
 */
export function stepDiceWorld(
  dice: readonly PhysicsDie[],
  bounds: TrayBounds,
  rawDtSeconds: number,
): PhysicsDie[] {
  if (dice.length === 0 || dice.every((d) => d.settled)) {
    return dice as PhysicsDie[];
  }

  const dt = Math.min(Math.max(rawDtSeconds, 0.001), MAX_DT);
  const linearDrag = Math.exp(-3.35 * dt);
  const angDrag = Math.exp(-3.8 * dt);

  const next: PhysicsDie[] = dice.map((d) => ({ ...d }));

  // 1. Integrate velocities, damping & walls
  for (const d of next) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += d.angularVel * dt;

    d.vx *= linearDrag;
    d.vy *= linearDrag;
    d.angularVel *= angDrag;

    const minX = bounds.padding + d.radius;
    const maxX = Math.max(minX, bounds.width - bounds.padding - d.radius);
    const minY = bounds.padding + d.radius;
    const maxY = Math.max(minY, bounds.height - bounds.padding - d.radius);

    if (d.x < minX) {
      d.x = minX;
      d.vx = Math.abs(d.vx) * WALL_RESTITUTION;
      d.angularVel += d.vy * 0.015;
    } else if (d.x > maxX) {
      d.x = maxX;
      d.vx = -Math.abs(d.vx) * WALL_RESTITUTION;
      d.angularVel -= d.vy * 0.015;
    }

    if (d.y < minY) {
      d.y = minY;
      d.vy = Math.abs(d.vy) * WALL_RESTITUTION;
      d.angularVel -= d.vx * 0.015;
    } else if (d.y > maxY) {
      d.y = maxY;
      d.vy = -Math.abs(d.vy) * WALL_RESTITUTION;
      d.angularVel += d.vx * 0.015;
    }
  }

  // 2. Pairwise elastic circle-circle collisions
  for (let i = 0; i < next.length; i += 1) {
    for (let j = i + 1; j < next.length; j += 1) {
      const a = next[i];
      const b = next[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = a.radius + b.radius + 1;
      const distSq = dx * dx + dy * dy;

      if (distSq >= minDist * minDist) continue;

      const dist = Math.sqrt(distSq) || 0.01;
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = (minDist - dist) * 0.5;

      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const velAlongNormal = rvx * nx + rvy * ny;
      if (velAlongNormal > 0) continue;

      const impulse = (-(1 + DIE_RESTITUTION) * velAlongNormal) / 2;
      a.vx -= impulse * nx;
      a.vy -= impulse * ny;
      b.vx += impulse * nx;
      b.vy += impulse * ny;

      const tangentSpin = (rvx * -ny + rvy * nx) * 0.02;
      a.angularVel -= tangentSpin;
      b.angularVel += tangentSpin;
      a.settled = false;
      b.settled = false;
    }
  }

  // 3. Tumble face preview & settle detection
  for (const d of next) {
    const minX = bounds.padding + d.radius;
    const maxX = Math.max(minX, bounds.width - bounds.padding - d.radius);
    const minY = bounds.padding + d.radius;
    const maxY = Math.max(minY, bounds.height - bounds.padding - d.radius);
    d.x = clampCoord(d.x, minX, maxX);
    d.y = clampCoord(d.y, minY, maxY);

    const speed = Math.hypot(d.vx, d.vy);
    if (speed > 42 || Math.abs(d.angularVel) > 3.6) {
      if (Math.random() < Math.min(0.45, speed / 420)) {
        d.previewValue = randomDieFace(d.faces);
      }
      d.settled = false;
    } else if (speed < STOP_SPEED && Math.abs(d.angularVel) < STOP_ANGULAR) {
      d.vx = 0;
      d.vy = 0;
      d.angularVel = 0;
      d.settled = true;
    } else {
      d.settled = false;
    }
  }

  return next;
}

/** Applies cursor/touch sweep impulse to any die near the pointer segment. */
export function applyPointerSweep(
  dice: readonly PhysicsDie[],
  prevX: number,
  prevY: number,
  nextX: number,
  nextY: number,
  dtSeconds: number,
): PhysicsDie[] {
  const dt = Math.max(dtSeconds, 0.008);
  const segDx = nextX - prevX;
  const segDy = nextY - prevY;
  const segLen = Math.hypot(segDx, segDy);
  if (segLen < 1.5) return dice as PhysicsDie[];

  const pvx = Math.max(-720, Math.min(720, segDx / dt));
  const pvy = Math.max(-720, Math.min(720, segDy / dt));
  let touched = false;

  const updated = dice.map((d) => {
    const dist = pointToSegmentDistance(d.x, d.y, prevX, prevY, nextX, nextY);
    const reach = d.radius + 14;
    if (dist > reach) return d;

    touched = true;
    const weight = 0.55 + 0.45 * (1 - dist / reach);
    const cross = (d.x - nextX) * segDy - (d.y - nextY) * segDx;
    return {
      ...d,
      vx: d.vx * 0.5 + pvx * weight * 0.72,
      vy: d.vy * 0.5 + pvy * weight * 0.72,
      angularVel: d.angularVel + Math.max(-14, Math.min(14, cross * 0.012)),
      previewValue: randomDieFace(d.faces),
      settled: false,
    };
  });

  return touched ? updated : (dice as PhysicsDie[]);
}

/** Applies global tray shake or flick (Space hold, button rattle, or tray pan). */
export function applyTrayImpulse(
  dice: readonly PhysicsDie[],
  accelX: number,
  accelY: number,
  jitter = 160,
): PhysicsDie[] {
  if (dice.length === 0) return dice as PhysicsDie[];
  return dice.map((d) => ({
    ...d,
    vx: Math.max(-680, Math.min(680, d.vx + accelX + (Math.random() - 0.5) * jitter)),
    vy: Math.max(-680, Math.min(680, d.vy + accelY + (Math.random() - 0.5) * jitter)),
    angularVel: Math.max(-16, Math.min(16, d.angularVel + (Math.random() - 0.5) * 12)),
    previewValue: randomDieFace(d.faces),
    settled: false,
  }));
}

function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}
