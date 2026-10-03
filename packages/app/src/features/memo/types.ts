export interface Memo {
  id: number;
  author: string;
  content: string;
  parent_id: number | null;
  created_at: string;
  tags: string[];
}
export interface MemoThreadData { memo: Memo; replies: Memo[] }
export interface PendingMemoTags { memoId: number; tags: string[]; rootId: number; error: string }
