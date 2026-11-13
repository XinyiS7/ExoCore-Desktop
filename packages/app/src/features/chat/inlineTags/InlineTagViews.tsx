import { useContext, useState, type ReactNode } from 'react';
import { Dices, EyeOff, Lock, Mic, Timer, TimerOff, VolumeX } from 'lucide-react';
import type { InlineTag } from './parse';
import type { InlineRollView } from '../types';
import { SpoilerUnlockContext } from './spoilerUnlock';
import './inlineTags.css';

/**
 * Leaf views for inline action tags (#130 CP1). Pure presentation: no side
 * effects, no API calls. Spoiler bodies come back through `renderBody` so the
 * caller keeps the one Markdown pipeline (and its sanitizer).
 */

export interface InlineTagViewProps {
  tag: InlineTag;
  streaming: boolean;
  renderBody: (body: string) => ReactNode;
  /** #130 CP2: this `<roll>`'s persisted result, when the backend has rolled it. */
  roll?: InlineRollView;
}

function Chip({ icon, children, title }: { icon: ReactNode; children: ReactNode; title?: string }) {
  return (
    <span className="app-itag-chip" title={title}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const parts: string[] = [];
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s) parts.push(`${s}s`);
  return parts.join('');
}

function SpeakCard({ tag, streaming }: { tag: Extract<InlineTag, { kind: 'speak' }>; streaming: boolean }) {
  const speaking = streaming && !tag.closed;
  const label = speaking ? '正在说话…' : tag.closed ? '语音' : '语音未完成';
  return (
    <div
      className={`app-itag-speak${speaking ? ' app-itag-speak--live' : ''}`}
      role="status"
      aria-label={label}
      data-itag="speak"
    >
      <Mic size={14} aria-hidden="true" />
      <span className="app-itag-speak-label">{label}</span>
      {tag.emotion ? <span className="app-itag-speak-emotion">{tag.emotion}</span> : null}
    </div>
  );
}

function SpoilerBlock({
  tag,
  renderBody,
}: {
  tag: Extract<InlineTag, { kind: 'spoiler' }>;
  renderBody: (body: string) => ReactNode;
}) {
  const isUnlocked = useContext(SpoilerUnlockContext);
  const [opened, setOpened] = useState(false);
  const pwdUnlocked = tag.pwd !== null && isUnlocked(tag.pwd);
  const revealed = tag.pwd === null ? opened : pwdUnlocked;

  if (revealed) {
    return (
      <div className="app-itag-spoiler app-itag-spoiler--open" data-itag="spoiler">
        {tag.cover ? <div className="app-itag-spoiler-cover">{tag.cover}</div> : null}
        <div className="app-itag-spoiler-body">{renderBody(tag.body)}</div>
      </div>
    );
  }

  // Locked: the body never enters the DOM.
  const cover = tag.cover ?? '剧透内容';
  if (tag.pwd !== null) {
    return (
      <div className="app-itag-spoiler app-itag-spoiler--locked" data-itag="spoiler">
        <Lock size={14} aria-hidden="true" />
        <span>{cover}</span>
        <span className="app-itag-spoiler-hint">需要口令</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="app-itag-spoiler app-itag-spoiler--masked"
      data-itag="spoiler"
      onClick={() => setOpened(true)}
    >
      <EyeOff size={14} aria-hidden="true" />
      <span>{cover}</span>
      <span className="app-itag-spoiler-hint">点击展开</span>
    </button>
  );
}

export function InlineTagView({ tag, streaming, renderBody, roll }: InlineTagViewProps) {
  switch (tag.kind) {
    case 'speak':
      return <SpeakCard tag={tag} streaming={streaming} />;
    case 'spoiler':
      return <SpoilerBlock tag={tag} renderBody={renderBody} />;
    case 'pin':
    case 'unpin':
      // D-F: never shown in a message body (placeholders drops them; the
      // sticky-note area renders pins from `inline_state.pins`).
      return null;
    case 'block':
      return (
        <Chip icon={<VolumeX size={12} aria-hidden="true" />}>
          {tag.seconds === 0 ? '解除禁言' : `禁言 ${formatSeconds(tag.seconds)}`}
        </Chip>
      );
    case 'timer':
      return (
        <Chip icon={<Timer size={12} aria-hidden="true" />}>
          {formatSeconds(tag.seconds)}
          {tag.title ? ` · ${tag.title}` : ''}
        </Chip>
      );
    case 'timer_cancel':
      return <Chip icon={<TimerOff size={12} aria-hidden="true" />}>取消计时 · {tag.title}</Chip>;
    case 'timer_fired':
      return (
        <Chip icon={<Timer size={12} aria-hidden="true" />} title={tag.fireAt}>
          计时到点{tag.title ? ` · ${tag.title}` : ''}
        </Chip>
      );
    case 'roll':
      // The result exists only once the reply is persisted; until then the chip shows the expression.
      return roll ? (
        <Chip icon={<Dices size={12} aria-hidden="true" />} title="助手掷骰">
          {tag.expr} → {roll.dice.join(', ')} = <strong>{roll.total}</strong>
        </Chip>
      ) : (
        <Chip icon={<Dices size={12} aria-hidden="true" />} title={streaming ? undefined : '未出结果'}>
          {tag.expr}
        </Chip>
      );
    case 'roll_result':
      // A user `<roll>` is immediately followed by its own result; the result chip alone carries it.
      return (
        <Chip icon={<Dices size={12} aria-hidden="true" />} title={tag.by === 'assistant' ? '助手掷骰' : '掷骰'}>
          {tag.expr} → {tag.dice.join(', ')} = <strong>{tag.total}</strong>
        </Chip>
      );
  }
}
