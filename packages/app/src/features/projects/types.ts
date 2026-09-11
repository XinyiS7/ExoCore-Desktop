/**
 * P2B Project resource row types (Plan §5.1/§5.3, D2/D3).
 *
 * Knowledge rows are normalized minimally — only the fields rendered or
 * edited (title/source/tags/keywords/abstract) — no general Knowledge
 * validation framework (Ablation: no Knowledge-detail Query while list rows
 * own the editable fields).
 */

/** Project Knowledge list row (GET /api/memory/knowledge/?project=<id>). */
export interface ProjectKnowledgeRow {
  /** Positive integer fragment id (PATCH target). */
  id: number;
  title: string;
  /** source_type metadata; unknown values get a neutral label. */
  sourceType: string | null;
  tags: string[];
  keywords: string[];
  abstract: string | null;
  updatedAt: string;
}

/** The only editable Knowledge fields (D2): abstract and/or keywords. */
export interface KnowledgePatchValues {
  abstract?: string;
  keywords?: string[];
}

/** PATCH /api/memory/knowledge/<pk>/ response envelope. */
export interface KnowledgePatchResult {
  msg: string;
  updated: string[];
}

/** One uploaded ProjectFile reported by GET delete-preview. */
export interface ProjectDeletePreviewFile {
  id: number;
  name: string;
  size: number;
}

/** Current-session destructive preview; not a canonical Project cache. */
export interface ProjectDeletePreview {
  conversationsToArchive: number;
  files: ProjectDeletePreviewFile[];
  filesTotalSize: number;
}