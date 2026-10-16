import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Image as ImageIcon, Music, Play } from 'lucide-react';
import { collectionImagePreviewUrl } from './api';
import { cardDate, cardTilt, cardTitle } from './filters';
import type { CollectionListItem } from './types';

interface PolaroidCardProps {
  item: CollectionListItem;
  /** Detail location, carrying the wall's search params so closing restores the filters. */
  to: { pathname: string; search: string };
  /**
   * #61 bring-back multi-select: the whole card becomes one toggle and its
   * links step aside. `order` is the 1-based selection order, null if unpicked;
   * `dimmed` marks an unpicked card once five are picked.
   */
  selection?: { order: number | null; onToggle: () => void; dimmed?: boolean };
}

function ImageThumb({ item }: { item: CollectionListItem }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ImageIcon className="polaroid-icon" size={44} aria-label="预览不可用" />;
  return (
    <img
      className="polaroid-thumb"
      src={collectionImagePreviewUrl(item.id)}
      alt={item.description.trim() || item.title.trim() || `图片藏品 #${item.id}`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** One wall card: content area above, title/date/Tags in the paper margin below. */
export function PolaroidCard({ item, to, selection }: PolaroidCardProps) {
  const title = cardTitle(item);
  const tags = item.tags.slice(0, 3).map((tag) => `#${tag}`).join(' ');
  const selecting = selection !== undefined;
  const picked = selecting && selection.order !== null;
  const dimmed = selecting && !picked && selection.dimmed === true;
  return (
    <article
      className={`polaroid polaroid--${item.kind}${picked ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}`}
      style={{ '--polaroid-tilt': `${cardTilt(item.id)}deg` } as CSSProperties}
    >
      {/* Selection dot on every card: empty when unpicked (state is the toggle's aria-pressed), numbered when picked. */}
      {selecting ? (
        picked ? (
          <span className="polaroid-dot is-picked" aria-label={`第 ${selection.order} 件`}>{selection.order}</span>
        ) : (
          <span className="polaroid-dot" aria-hidden="true" />
        )
      ) : null}
      <div className="polaroid-content">
        {item.kind === 'text' && <p className="polaroid-preview">{item.preview}</p>}
        {item.kind === 'image' && <ImageThumb item={item} />}
        {item.kind === 'audio' && (
          <>
            <Music className="polaroid-icon" size={36} aria-hidden="true" />
            {/* Play = open the detail and start playback there (one view, Plan §5.1). */}
            {selecting ? null : (
              <Link className="polaroid-play" to={to} state={{ autoplay: true }} aria-label={`播放 ${title}`}>
                <Play size={14} aria-hidden="true" />
              </Link>
            )}
          </>
        )}
        {item.kind === 'document' && (
          <span className="polaroid-doc">
            <FileText size={38} aria-hidden="true" />
            <span>文档</span>
          </span>
        )}
      </div>
      <div className="polaroid-caption">
        <span className="polaroid-title-row">
          {/* Stretched link (or, while selecting, toggle): the whole card is the target. */}
          {selecting ? (
            <button
              type="button"
              className="polaroid-link polaroid-select"
              aria-pressed={picked}
              onClick={selection.onToggle}
            >
              {title}
            </button>
          ) : (
            <Link className="polaroid-link" to={to}>{title}</Link>
          )}
          {item.collection_context.trim() && <span className="polaroid-reason" role="img" aria-label="有收藏理由" title="有收藏理由" />}
        </span>
        <time className="polaroid-meta" dateTime={item.collected_at}>{cardDate(item.collected_at)}</time>
        {tags && <span className="polaroid-meta">{tags}</span>}
      </div>
    </article>
  );
}
