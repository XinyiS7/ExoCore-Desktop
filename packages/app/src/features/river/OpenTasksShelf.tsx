import { useOpenTasksQuery } from './queries';

export function OpenTasksShelf({ onOpenCalendar, onCreateTask, onOpenTask }: {
  onOpenCalendar: () => void;
  onCreateTask: () => void;
  onOpenTask: (entryId: number) => void;
}) {
  const query = useOpenTasksQuery();
  return <section className="river-shelf" aria-labelledby="river-shelf-title">
    <header className="river-shelf-head">
      <h2 id="river-shelf-title">未完成事项 {query.isSuccess && <span className="river-shelf-count">{query.data.length}</span>}</h2>
      <div className="river-shelf-actions">
        <button type="button" onClick={onOpenCalendar}>日历</button>
        <button type="button" className="river-shelf-create" onClick={onCreateTask}>＋ 新建待办</button>
      </div>
    </header>
    <p className="river-precision-note">全局任务 · 按来源置顶与日期顺序 · 卡片打开与 River 事件相同的任务详情</p>
    {query.isPending && <p role="status" className="river-status-note">正在加载未完成事项…</p>}
    {query.isError && <div role="alert" className="river-alert river-alert--danger"><p>未完成事项读取失败：{query.error.message}</p><button type="button" onClick={() => { void query.refetch(); }}>重试任务条带</button></div>}
    {query.isSuccess && (query.data.length === 0 ? <p className="river-empty-note">暂无未完成事项。</p> : <ul className="river-shelf-list">
      {query.data.map((task) => {
        const due = task.entry_type === 'periodic' ? task.next_periodic_due : task.entry_type === 'goal' ? task.cycle_due : task.due_date;
        return <li key={task.id}>
          <h3>{task.is_pinned && <span aria-label="已置顶">📌 </span>}{task.title}</h3>
          <p className="river-shelf-meta">{task.entry_type} · {task.status === 'escalated' ? '已升级' : '进行中'}</p>
          <p className={`river-shelf-due${due ? '' : ' river-shelf-due--none'}`}>{due ? `日期 ${due}` : '未设置截止日期'}</p>
          <button type="button" className="river-shelf-open" onClick={() => onOpenTask(task.id)}>打开详情</button>
        </li>;
      })}
    </ul>)}
  </section>;
}
