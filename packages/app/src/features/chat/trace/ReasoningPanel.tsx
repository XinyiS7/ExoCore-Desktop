import { MessageContent } from '../MessageContent';

export function ReasoningPanel({ text, streaming = false }: { text: string; streaming?: boolean }) {
  if (!text.trim()) return null;
  return (
    <section className="app-reasoning-panel" aria-label="思考过程">
      <MessageContent content={text} />
      {streaming ? <span className="app-muted">思考中…</span> : null}
    </section>
  );
}
