import { COLLECTION_KINDS, type CollectionFilters, type CollectionKind, type CollectionListItem } from './types';

/**
 * Wall filters live in the URL search params (Plan §3.1); the cursor never does.
 * Unknown or malformed values are dropped rather than sent to the server.
 */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function parseWallFilters(params: URLSearchParams): CollectionFilters {
  const kind = params.get('kind');
  const month = params.get('month');
  return {
    kind: COLLECTION_KINDS.includes(kind as CollectionKind) ? (kind as CollectionKind) : undefined,
    tag: params.get('tag') || undefined,
    q: params.get('q') || undefined,
    recent: params.get('recent') === '1' || undefined,
    month: month && MONTH.test(month) ? month : undefined,
    link: params.get('link') === '1' || undefined,
  };
}

export function wallFiltersToParams(filters: CollectionFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.q) params.set('q', filters.q);
  if (filters.recent) params.set('recent', '1');
  if (filters.month) params.set('month', filters.month);
  if (filters.link) params.set('link', '1');
  return params;
}

export function hasActiveFilters(filters: CollectionFilters): boolean {
  return wallFiltersToParams(filters).toString() !== '';
}

export const KIND_LABELS: Record<CollectionKind, string> = {
  text: '文字',
  image: '图片',
  audio: '语音',
  document: '文档',
};

/** Card title: title, then the description's first line, then "未命名" (documents: "文档 #id"). */
export function cardTitle(item: Pick<CollectionListItem, 'id' | 'kind' | 'title' | 'description'>): string {
  const title = item.title.trim();
  if (title) return title;
  const firstLine = item.description.trim().split('\n')[0]?.trim();
  if (firstLine) return firstLine;
  return item.kind === 'document' ? `文档 #${item.id}` : '未命名';
}

/** Local collection date: "MM-DD HH:mm" within the current year, else "YYYY-MM-DD". */
export function cardDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (date.getFullYear() === now.getFullYear()) return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return `${date.getFullYear()}-${day}`;
}

/** A small, stable tilt per item so the wall reads as pinned polaroids. */
export function cardTilt(id: number): number {
  return ((id * 37) % 5 - 2) * 0.45;
}
