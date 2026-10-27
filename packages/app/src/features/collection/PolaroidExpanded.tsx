import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal, X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';
import { CollectionApiError } from './api';
import { BringTargetDialog } from './BringTargetDialog';
import { CollectionDeleteDialog } from './CollectionDeleteDialog';
import { CollectionEditForm, ManualCalibrationForm } from './CollectionEditForm';
import { cardTitle, KIND_LABELS } from './filters';
import {
  localDateTime,
  REPRESENTATION_LABELS,
  REPRESENTATION_STATE_LABELS,
  roleLabel,
  SOURCE_LABELS,
} from './presentation';
import {
  useAddCollectionComment,
  useCollectionItemQuery,
  useDeleteCollectionComment,
  useRecordViewOnce,
  useRetryRepresentation,
} from './queries';
import type { CollectionComment, CollectionDetail, CollectionRepresentation, RepresentationKind } from './types';

type Mode = 'read' | 'edit' | 'calibrate';

/** Route element for /library/items/:itemId, layered over the still-mounted wall. */
export function PolaroidExpanded() {
  const { itemId } = useParams();
  const id = Number(itemId);
  const valid = Number.isSafeInteger(id) && id > 0 && String(id) === itemId;
  const location = useLocation();
  const navigate = useNavigate();
  const close = () => navigate({ pathname: '/library', search: location.search });
  return valid ? <ExpandedDialog key={id} id={id} onClose={close} /> : <ExpandedShell onClose={close} title="藏品不存在"><NotFound /></ExpandedShell>;
}

function NotFound() {
  return <div className="library-state" role="alert"><p>藏品不存在或已删除</p></div>;
}

interface ShellProps {
  title: string;
  meta?: string;
  onClose: () => void;
  locked?: boolean;
  actions?: ReactNode;
  children: ReactNode;
}

/** Overlay + dialog frame; wide: centered panel, narrow: full page with a sticky bar. */
function ExpandedShell({ title, meta, onClose, locked = false, actions, children }: ShellProps) {
  const dialogRef = useDialogA11y(true, onClose, { locked, closeDisabledWhileLocked: true });
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="library-overlay" onClick={(event) => { if (event.target === event.currentTarget && !locked) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`藏品 ${title}`} className="library-expanded">
        <header className="library-expanded-bar">
          {/* One close control, first in focus order: a back arrow on narrow, × at the end on wide. */}
          <button type="button" className="library-close" aria-label="关闭" disabled={locked} onClick={onClose}>
            <ChevronLeft className="library-close-back" size={20} aria-hidden="true" />
            <X className="library-close-x" size={18} aria-hidden="true" />
          </button>
          <span className="library-expanded-meta">{meta}</span>
          {actions && (
            <>
              <button
                type="button"
                className="library-menu-toggle"
                aria-label="更多：带回聊天、编辑、删除"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              <div className={`library-expanded-actions${menuOpen ? ' is-open' : ''}`}>{actions}</div>
            </>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

function ExpandedDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const location = useLocation();
  const query = useCollectionItemQuery(id);
  const viewStatus = useRecordViewOnce(id, location.key, query.isSuccess);
  const [mode, setMode] = useState<Mode>('read');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bringing, setBringing] = useState(false);

  if (query.isPending) {
    return <ExpandedShell title={`#${id}`} onClose={onClose}><p role="status" className="library-state">正在加载藏品…</p></ExpandedShell>;
  }
  if (query.isError) {
    const missing = query.error instanceof CollectionApiError && query.error.code === 'collection_item_not_found';
    return (
      <ExpandedShell title={`#${id}`} onClose={onClose}>
        {missing ? <NotFound /> : (
          <div className="library-state" role="alert">
            <p>藏品加载失败：{query.error.message}</p>
            <button type="button" className="app-btn" onClick={() => { void query.refetch(); }}>重试</button>
          </div>
        )}
      </ExpandedShell>
    );
  }

  const detail = query.data;
  const title = cardTitle(detail);
  const locked = saving || confirmDelete || bringing;
  return (
    <ExpandedShell
      title={title}
      meta={`${KIND_LABELS[detail.kind]} · #${detail.id} · 收藏于 ${localDateTime(detail.collected_at)}`}
      onClose={onClose}
      locked={locked}
      actions={mode === 'read' ? (
        <>
          <button type="button" className="app-btn" onClick={() => setBringing(true)}>带回聊天</button>
          {detail.capabilities.includes('update') && <button type="button" className="app-btn" onClick={() => setMode('edit')}>编辑</button>}
          {detail.capabilities.includes('delete') && (
            <button type="button" className="app-btn library-btn-danger-ghost" onClick={() => setConfirmDelete(true)}>删除</button>
          )}
        </>
      ) : undefined}
    >
      <div className="library-expanded-media">
        <figure className="polaroid polaroid--large">
          <OriginalArea detail={detail} />
          <figcaption className="polaroid-title-large">{title}</figcaption>
        </figure>
        <RepresentationStatus detail={detail} />
      </div>
      <div className="library-expanded-info">
        {mode === 'edit' && <CollectionEditForm detail={detail} onDone={() => setMode('read')} onSavingChange={setSaving} />}
        {mode === 'calibrate' && (
          <ManualCalibrationForm
            detail={detail}
            initialText={extractedText(detail)?.canonical_text ?? ''}
            onDone={() => setMode('read')}
          />
        )}
        {viewStatus === 'error' && <p role="status" className="library-note">本次浏览未记录</p>}
        {mode === 'read' && <ReadingSections detail={detail} onCalibrate={() => setMode('calibrate')} />}
      </div>
      {bringing && (
        <BringTargetDialog itemIds={[detail.id]} titles={[title]} onCancel={() => setBringing(false)} />
      )}
      {confirmDelete && (
        <CollectionDeleteDialog
          itemId={detail.id}
          title={title}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={onClose}
        />
      )}
    </ExpandedShell>
  );
}

function representation(detail: CollectionDetail, kind: RepresentationKind): CollectionRepresentation | undefined {
  return detail.representations.find((entry) => entry.kind === kind);
}
function extractedText(detail: CollectionDetail) {
  return representation(detail, 'document_extracted_text');
}

/** Original content per kind; a failed preview never hides an available original. */
function OriginalArea({ detail }: { detail: CollectionDetail }) {
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [failed, setFailed] = useState(false);
  const original = detail.capabilities.includes('read_original') ? detail.original_content_url : null;
  const autoplay = (location.state as { autoplay?: boolean } | null)?.autoplay === true;

  useEffect(() => {
    if (!autoplay || !audioRef.current) return;
    // Browsers may refuse autoplay; the visible controls remain the fallback.
    audioRef.current.play()?.catch(() => undefined);
  }, [autoplay]);

  if (detail.kind === 'text') {
    return <div className="library-original library-original--text"><p>{detail.text_content}</p></div>;
  }
  const unavailable = <div className="library-original library-original--empty"><p>原件不可用</p></div>;
  if (detail.kind === 'image') {
    const preview = representation(detail, 'image_preview');
    const previewUrl = preview?.state === 'succeeded' ? preview.content_url : null;
    const src = previewUrl ?? original;
    if (!src || failed) return unavailable;
    return (
      <div className="library-original">
        <img
          src={src}
          alt={detail.description.trim() || detail.title.trim() || `图片藏品 #${detail.id}`}
          onError={() => setFailed(true)}
        />
        {!previewUrl && <span className="library-flag">预览不可用</span>}
        {original && <a className="library-original-link" href={original} target="_blank" rel="noreferrer">查看原件</a>}
      </div>
    );
  }
  if (detail.kind === 'audio') {
    const playback = representation(detail, 'audio_playback');
    const src = (playback?.state === 'succeeded' ? playback.content_url : null) ?? original;
    if (!src || failed) return unavailable;
    return (
      <div className="library-original library-original--audio">
        <audio ref={audioRef} controls src={src} onError={() => setFailed(true)} aria-label={`播放 ${cardTitle(detail)}`} />
      </div>
    );
  }
  if (!original) return unavailable;
  return (
    <div className="library-original library-original--document">
      <a className="app-btn" href={original} target="_blank" rel="noreferrer">打开原件</a>
    </div>
  );
}

function RepresentationStatus({ detail }: { detail: CollectionDetail }) {
  const retry = useRetryRepresentation(detail.id);
  if (detail.representations.length === 0) return null;
  const notRetryable = retry.error instanceof CollectionApiError && retry.error.code === 'derivation_not_retryable';
  return (
    <div className="library-reps">
      <ul aria-label="派生状态">
        {detail.representations.map((entry) => (
          <li key={entry.kind} data-state={entry.state}>
            <span>{REPRESENTATION_LABELS[entry.kind]}：{REPRESENTATION_STATE_LABELS[entry.state]}</span>
            {entry.state === 'failed' && entry.error_code && <span className="library-rep-code">（{entry.error_code}）</span>}
            {entry.retry_url && (
              <button
                type="button"
                className="app-btn library-btn-small"
                disabled={retry.isPending}
                onClick={() => retry.mutate(entry.kind)}
              >
                {retry.isPending && retry.variables === entry.kind ? '重试中…' : '重试'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {retry.isError && (
        <p role="alert" className="library-note">
          {notRetryable ? '当前状态不能重试，已刷新。' : `重试失败：${retry.error.message}`}
        </p>
      )}
    </div>
  );
}

function ReadingSections({ detail, onCalibrate }: { detail: CollectionDetail; onCalibrate: () => void }) {
  const extracted = detail.kind === 'document' ? extractedText(detail) : undefined;
  const message = detail.source.message;
  const role = message ? roleLabel(message.role) : null;
  return (
    <>
      {detail.collection_context.trim() && (
        <section className="library-section">
          <h2>收藏理由</h2>
          <p>{detail.collection_context}</p>
        </section>
      )}
      <section className="library-section">
        <h2>描述</h2>
        <p className={detail.description.trim() ? undefined : 'library-note'}>{detail.description.trim() || '暂无描述'}</p>
      </section>
      {detail.tags.length > 0 && (
        <section className="library-section">
          <h2>Tags</h2>
          <div className="library-tag-list">{detail.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
        </section>
      )}
      {extracted && (
        <section className="library-section">
          <h2>提取文本</h2>
          {extracted.canonical_text ? (
            <details className="library-extracted">
              <summary>展开全文</summary>
              <p>{extracted.canonical_text}</p>
            </details>
          ) : <p className="library-note">暂无提取文本</p>}
          {detail.capabilities.includes('update') && (
            <button type="button" className="app-btn library-btn-small" onClick={onCalibrate}>人工校准</button>
          )}
        </section>
      )}
      <section className="library-section">
        <h2>来源</h2>
        <p>
          {[SOURCE_LABELS[detail.source.type], role, message ? localDateTime(message.created_at) : null].filter(Boolean).join(' · ')}
          {detail.source.available && message && (
            <> · <Link to={`/chat/${message.conversation_id}`}>打开来源会话</Link></>
          )}
          {!detail.source.available && <span className="library-note">（来源已不可用）</span>}
        </p>
      </section>
      <ViewerStats detail={detail} />
      <Comments detail={detail} />
    </>
  );
}

/** Backend rows as given: identity label and counts are shown without relabeling (UI-D2). */
function ViewerStats({ detail }: { detail: CollectionDetail }) {
  return (
    <section className="library-section">
      <h2 id="library-stats-title">统计</h2>
      {detail.viewer_stats.length === 0 ? <p className="library-note">还没有浏览记录</p> : (
        <table className="library-stats" aria-labelledby="library-stats-title">
          <thead>
            <tr><th scope="col"><span className="library-sr">谁</span></th><th scope="col">看过</th><th scope="col">带回</th><th scope="col">收藏</th></tr>
          </thead>
          <tbody>
            {detail.viewer_stats.map((stat) => (
              <tr key={`${stat.viewer_type}:${stat.viewer_key}`}>
                <th scope="row">{stat.label}</th>
                <td>{stat.view_count}</td>
                <td>{stat.show_count}</td>
                <td>{stat.collect_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Same rule as the backend: code points after trim (an emoji is one, not two UTF-16 units). */
const COMMENT_LIMIT = 2000;

/**
 * Flat comments; Alicia writes and deletes her own. Shown newest first: the API order
 * (oldest first, ties by id) is reversed here only. No reply/edit/like.
 */
function Comments({ detail }: { detail: CollectionDetail }) {
  const ordered = detail.comments
    .map((comment, index) => ({ comment, index }))
    .sort((a, b) => Date.parse(b.comment.created_at) - Date.parse(a.comment.created_at) || b.index - a.index)
    .map(({ comment }) => comment);
  return (
    <section className="library-section">
      <h2>评论</h2>
      <CommentComposer itemId={detail.id} />
      {ordered.length === 0 ? <p className="library-note">暂无评论</p> : (
        <ol className="library-comments" aria-label="评论">
          {ordered.map((comment) => <CommentRow key={comment.id} itemId={detail.id} comment={comment} />)}
        </ol>
      )}
    </section>
  );
}

function CommentComposer({ itemId }: { itemId: number }) {
  const [draft, setDraft] = useState('');
  const add = useAddCollectionComment(itemId);
  const length = Array.from(draft.trim()).length;
  const tooLong = length > COMMENT_LIMIT;
  const blocked = length === 0 || tooLong || add.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (blocked) return;
    add.mutate(draft, { onSuccess: () => setDraft('') });
  };
  return (
    <form className="library-comment-form" onSubmit={submit} aria-label="发表评论">
      <textarea
        className="app-input library-textarea"
        aria-label="评论内容"
        value={draft}
        rows={3}
        aria-describedby={tooLong ? 'library-comment-count' : undefined}
        aria-invalid={tooLong}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="library-comment-actions">
        {tooLong && (
          <span id="library-comment-count" className="library-count is-over">
            {length} / {COMMENT_LIMIT}，超出上限
          </span>
        )}
        <button type="submit" className="app-btn library-btn-small" disabled={blocked}>
          {add.isPending ? '发表中…' : '发表'}
        </button>
      </div>
      {add.isError && <p role="alert" className="library-note">发表失败：{add.error.message}</p>}
    </form>
  );
}

/** Inline confirm before DELETE; on failure the comment stays with its error and can be retried. */
function CommentRow({ itemId, comment }: { itemId: number; comment: CollectionComment }) {
  const [confirming, setConfirming] = useState(false);
  const remove = useDeleteCollectionComment(itemId);
  const cancel = () => { setConfirming(false); remove.reset(); };
  return (
    <li>
      <div className="library-comment-meta">{comment.author_label} · <time dateTime={comment.created_at}>{localDateTime(comment.created_at)}</time></div>
      <p>{comment.body}</p>
      {comment.can_delete && (confirming ? (
        <div className="library-comment-confirm" role="group" aria-label="确认删除评论">
          <span>确认删除？</span>
          <button
            type="button"
            className="app-btn library-btn-small library-btn-danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate(comment.id)}
          >
            {remove.isPending ? '删除中…' : '删除'}
          </button>
          <button type="button" className="app-btn library-btn-small" disabled={remove.isPending} onClick={cancel}>取消</button>
        </div>
      ) : (
        <button
          type="button"
          className="app-btn library-btn-small library-btn-danger-ghost"
          aria-label="删除这条评论"
          onClick={() => setConfirming(true)}
        >
          删除
        </button>
      ))}
      {remove.isError && <p role="alert" className="library-note">删除失败：{remove.error.message}</p>}
    </li>
  );
}
