import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RiverPage } from '../features/river/RiverPage';
import { localDateString } from '../features/tasks/taskPayloads';
import { memoItem } from './river_fixtures';
import { calendarEvent, calendarSnapshot, installTaskServer, taskEntry } from './task_test_server';
import { jsonResponse, renderV4, unmockFetch } from './helpers';

type HttpCall = { url: URL; init?: RequestInit };
const posts = (calls: HttpCall[]) => calls.filter((call) => call.init?.method === 'POST');
const patches = (calls: HttpCall[]) => calls.filter((call) => call.init?.method === 'PATCH');
const deletes = (calls: HttpCall[]) => calls.filter((call) => call.init?.method === 'DELETE');
const riverHomes = (calls: HttpCall[]) =>
  calls.filter((call) => call.url.pathname === '/api/core/river/' && !call.url.searchParams.has('cursor'));
const riverCursors = (calls: HttpCall[]) =>
  calls.filter((call) => call.url.pathname === '/api/core/river/' && call.url.searchParams.has('cursor'));

/** Local-calendar day arithmetic, matching how the UI computes postpone dates. */
function plusDays(days: number): string {
  const [year, month, day] = localDateString().split('-').map(Number);
  return localDateString(new Date(year, month - 1, day + days));
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * `YYYY-MM-DDTHH:mm:00±HH:MM` at the runtime's own local offset. Building the
 * expected local reading and the source string from the same Date keeps the
 * calendar assertions valid in any timezone (incl. DST zones).
 */
function localIso(day: string, hour: number, minute = 0): string {
  const [year, month, date] = day.split('-').map(Number);
  const at = new Date(year, month - 1, date, hour, minute, 0, 0);
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  const localDay = `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`;
  return `${localDay}T${pad2(at.getHours())}:${pad2(at.getMinutes())}:00${sign}${pad2(Math.floor(absolute / 60))}:${pad2(absolute % 60)}`;
}

async function shelf() {
  return await screen.findByRole('region', { name: /未完成事项/ });
}

async function renderRiver() {
  renderV4(<RiverPage />);
  return await shelf();
}

async function openTaskForm() {
  const region = await shelf();
  fireEvent.click(within(region).getByRole('button', { name: '＋ 新建待办' }));
  return await screen.findByRole('dialog');
}

async function openTaskDetail(title: string) {
  const region = await shelf();
  const heading = await within(region).findByRole('heading', { name: new RegExp(title) });
  fireEvent.click(within(heading.closest('li')!).getByRole('button', { name: '打开详情' }));
  const dialog = await screen.findByRole('dialog');
  // The detail owns a real GET; wait for the canonical entry before asserting fields.
  await within(dialog).findByRole('heading', { name: `任务详情 · ${title}` });
  return dialog;
}

async function openCalendar() {
  const region = await shelf();
  fireEvent.click(within(region).getByRole('button', { name: '日历' }));
  return await screen.findByRole('dialog');
}

afterEach(() => {
  cleanup();
  unmockFetch();
});

describe('CP3 task creation and editing', () => {
  it('creates todo, periodic and goal with native fields and no readonly leakage', async () => {
    const { server, calls } = installTaskServer();
    await renderRiver();

    let dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: ' 买牛奶 ' } });
    fireEvent.change(within(dialog).getByLabelText(/截止日期/), { target: { value: '2026-10-05' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByRole('combobox', { name: '任务类型' }), { target: { value: 'periodic' } });
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '每周拉伸' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '每' }), { target: { value: 'week' } });
    fireEvent.change(within(dialog).getByLabelText(/间隔数值/), { target: { value: '2' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '结束方式' }), { target: { value: 'count' } });
    fireEvent.change(within(dialog).getByLabelText(/结束次数/), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByRole('combobox', { name: '任务类型' }), { target: { value: 'goal' } });
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '月度目标' } });
    fireEvent.change(within(dialog).getByLabelText(/每周期目标次数/), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '目标周期' }), { target: { value: 'month' } });
    fireEvent.change(within(dialog).getByLabelText('周期开始'), { target: { value: '2026-10-01' } });
    fireEvent.change(within(dialog).getByLabelText('周期截止'), { target: { value: '2026-10-31' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const created = posts(calls).filter((call) => call.url.pathname === '/api/tasks/entries/');
    expect(created).toHaveLength(3);
    expect(JSON.parse(String(created[0].init?.body))).toEqual({
      entry_type: 'todo',
      title: '买牛奶',
      description: '',
      start_date: localDateString(),
      tags: [],
      is_pinned: false,
      due_date: '2026-10-05',
    });
    expect(JSON.parse(String(created[1].init?.body))).toEqual({
      entry_type: 'periodic',
      title: '每周拉伸',
      description: '',
      start_date: localDateString(),
      tags: [],
      is_pinned: false,
      interval_unit: 'week',
      interval_value: 2,
      end_type: 'count',
      end_count: 3,
      end_date: null,
    });
    expect(JSON.parse(String(created[2].init?.body))).toEqual({
      entry_type: 'goal',
      title: '月度目标',
      description: '',
      start_date: localDateString(),
      tags: [],
      is_pinned: false,
      goal_count: 3,
      goal_period: 'month',
      cycle_start: '2026-10-01',
      cycle_due: '2026-10-31',
    });
    for (const call of created) {
      const body = JSON.parse(String(call.init?.body)) as Record<string, unknown>;
      for (const field of ['status', 'occurrences_done', 'gcal_event_id', 'gcal_event_link', 'id']) {
        expect(body).not.toHaveProperty(field);
      }
    }
    expect(server.entries.size).toBe(3);
    const region = await shelf();
    expect(within(region).getByText('买牛奶')).toBeInTheDocument();
    expect(within(region).getByText('每周拉伸')).toBeInTheDocument();
    expect(within(region).getByText('月度目标')).toBeInTheDocument();
  });

  it('edits through the native form without ever sending entry_type or readonly state', async () => {
    const { server, calls } = installTaskServer([taskEntry({ id: 41, title: '原任务', entry_type: 'todo' })]);
    await renderRiver();
    const detail = await openTaskDetail('原任务');
    fireEvent.click(within(detail).getByRole('button', { name: '编辑任务' }));
    const form = await screen.findByRole('dialog');
    expect(within(form).queryByRole('combobox', { name: '任务类型' })).not.toBeInTheDocument();
    expect(within(form).getByText(/任务类型创建后不可更改/)).toBeInTheDocument();

    fireEvent.change(within(form).getByLabelText(/标题/), { target: { value: '改后标题' } });
    fireEvent.click(within(form).getByRole('button', { name: '保存修改' }));
    await screen.findByRole('heading', { name: '任务详情 · 改后标题' });

    const patch = patches(calls).find((call) => call.url.pathname === '/api/tasks/entries/41/')!;
    const body = JSON.parse(String(patch.init?.body)) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'description',
      'due_date',
      'is_pinned',
      'start_date',
      'tags',
      'title',
    ]);
    for (const field of [
      'entry_type',
      'status',
      'occurrences_done',
      'gcal_event_id',
      'gcal_event_link',
      'created_at',
      'updated_at',
      'current_cycle_completions',
      'next_periodic_due',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
    expect(server.entries.get(41)!.title).toBe('改后标题');
  });

  it('preserves canonical tags containing separators on an unrelated edit roundtrip', async () => {
    const canonicalTags = ['comma,tag', 'multi\nline', 'a、b'];
    const { server, calls } = installTaskServer([
      taskEntry({ id: 47, title: '标签任务', entry_type: 'todo', tags: canonicalTags }),
    ]);
    await renderRiver();
    const detail = await openTaskDetail('标签任务');
    fireEvent.click(within(detail).getByRole('button', { name: '编辑任务' }));
    const form = await screen.findByRole('dialog');
    // One row per element — commas/newlines/ideographic commas are never separators.
    expect(within(form).getByLabelText('标签 1')).toHaveValue('comma,tag');
    expect(within(form).getByLabelText('标签 2')).toHaveValue('multi\nline');
    expect(within(form).getByLabelText('标签 3')).toHaveValue('a、b');

    fireEvent.change(within(form).getByLabelText(/标题/), { target: { value: '标签任务改' } });
    fireEvent.click(within(form).getByRole('button', { name: '保存修改' }));
    await screen.findByRole('heading', { name: '任务详情 · 标签任务改' });

    const patch = patches(calls).find((call) => call.url.pathname === '/api/tasks/entries/47/')!;
    expect(JSON.parse(String(patch.init?.body))).toMatchObject({ title: '标签任务改', tags: canonicalTags });
    expect(server.entries.get(47)!.tags).toEqual(canonicalTags);
  });

  it('adds/removes tag rows without splitting on separators and still trims', async () => {
    const { server, calls } = installTaskServer();
    await renderRiver();
    const dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '标签新增' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /添加标签/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /添加标签/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /添加标签/ }));
    fireEvent.change(within(dialog).getByLabelText('标签 1'), { target: { value: '逗号,标签' } });
    fireEvent.change(within(dialog).getByLabelText('标签 2'), { target: { value: '换行\n标签' } });
    fireEvent.change(within(dialog).getByLabelText('标签 3'), { target: { value: '、顿号、' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /删除标签 3/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: /添加标签/ }));
    fireEvent.change(within(dialog).getByLabelText('标签 3'), { target: { value: ' 空格保留 ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    const created = posts(calls).find((call) => call.url.pathname === '/api/tasks/entries/')!;
    expect(JSON.parse(String(created.init?.body)).tags).toEqual(['逗号,标签', '换行\n标签', '空格保留']);
    expect(server.entries.get(1)!.tags).toEqual(['逗号,标签', '换行\n标签', '空格保留']);
  });

  it.each(['network', '503', 'malformed 201'])(
    'preserves typed fields and warns to verify an uncertain %s create without an automatic retry',
    async (kind) => {
      const { server, calls } = installTaskServer();
      server.create = () => {
        if (kind === 'network') throw new TypeError('network down');
        if (kind === '503') return jsonResponse({ detail: '创建服务暂时不可用' }, 503);
        return jsonResponse({ id: 'not-a-number', title: 3 }, 201);
      };
      await renderRiver();
      const dialog = await openTaskForm();
      fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '保留输入标题' } });
      fireEvent.change(within(dialog).getByLabelText(/截止日期/), { target: { value: '2026-10-09' } });
      fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));

      const alert = await within(dialog).findByRole('alert');
      expect(alert).toHaveTextContent(
        kind === 'network' ? '网络连接失败' : kind === '503' ? '创建服务暂时不可用' : '任务编号异常',
      );
      expect(alert).toHaveTextContent(/保存结果不确定，请先刷新核对（可能已创建）；本次不会自动重试。/);
      expect(within(dialog).getByLabelText(/标题/)).toHaveValue('保留输入标题');
      expect(within(dialog).getByLabelText(/截止日期/)).toHaveValue('2026-10-09');
      expect(within(dialog).getByRole('button', { name: '再次保存（可能重复）' })).toBeInTheDocument();
      expect(posts(calls).filter((call) => call.url.pathname === '/api/tasks/entries/')).toHaveLength(1);
      expect(server.entries.size).toBe(0);
    },
  );

  it('keeps goal cycle boundaries optional and explains the nullable boundaries without a roll promise', async () => {
    const { server, calls } = installTaskServer();
    await renderRiver();
    const dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByRole('combobox', { name: '任务类型' }), { target: { value: 'goal' } });
    const goalSection = within(dialog).getByRole('region', { name: '目标设置' });
    expect(within(goalSection).getByText(/均可留空，留空不会被自动初始化/)).toBeInTheDocument();
    expect(within(goalSection).getByText(/仅当 cycle_due 已设置时/)).toBeInTheDocument();
    expect(within(goalSection).getByText(/未设置 cycle_due 时不会自动滚动/)).toBeInTheDocument();
    expect(within(goalSection).queryByText(/午夜任务负责滚动/)).not.toBeInTheDocument();
    expect(within(goalSection).getByLabelText('周期开始')).toHaveValue('');
    expect(within(goalSection).getByLabelText('周期截止')).toHaveValue('');
    expect(goalSection.querySelectorAll('.app-required')).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '无边界目标' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const created = posts(calls).find((call) => call.url.pathname === '/api/tasks/entries/')!;
    expect(JSON.parse(String(created.init?.body))).toMatchObject({
      entry_type: 'goal',
      cycle_start: null,
      cycle_due: null,
    });
    expect(server.entries.get(1)!.cycle_start).toBeNull();
    expect(server.entries.get(1)!.cycle_due).toBeNull();
  });
});

describe('CP3 task detail actions', () => {
  it('records completion notes: todo archives, periodic/goal stay canonical after re-read', async () => {
    const { server, calls } = installTaskServer([
      taskEntry({ id: 41, title: '一次性任务', entry_type: 'todo', due_date: '2026-10-03' }),
      taskEntry({ id: 42, title: '周期任务', entry_type: 'periodic', interval_unit: 'day', interval_value: 1, end_type: 'never' }),
      taskEntry({ id: 43, title: '目标任务', entry_type: 'goal', goal_count: 3, goal_period: 'week', cycle_start: '2026-09-28', cycle_due: '2026-10-04' }),
    ]);
    const region = await renderRiver();
    const completes = () => posts(calls).filter((call) => call.url.pathname.endsWith('/complete/'));

    let dialog = await openTaskDetail('一次性任务');
    fireEvent.change(within(dialog).getByLabelText(/完成备注/), { target: { value: '做完啦' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '记录完成' }));
    await within(dialog).findByText(/已提交完成记录/);
    expect(JSON.parse(String(completes()[0].init?.body))).toEqual({ note: '做完啦' });
    expect(server.entries.get(41)!.status).toBe('archived');
    expect(within(dialog).getByText('已归档')).toBeInTheDocument();
    expect(within(dialog).getByText(/任务已归档，不再接受完成打卡/)).toBeInTheDocument();
    expect(within(region).queryByText('一次性任务')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭任务详情' }));
    dialog = await openTaskDetail('周期任务');
    fireEvent.click(within(dialog).getByRole('button', { name: '记录完成' }));
    await within(dialog).findByText(/已提交完成记录/);
    expect(JSON.parse(String(completes()[1].init?.body))).toEqual({});
    expect(server.entries.get(42)!.occurrences_done).toBe(1);
    expect(server.entries.get(42)!.status).toBe('active');
    expect(within(dialog).getByText('进行中')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '记录完成' })).toBeInTheDocument();
    expect(within(region).getByText('周期任务')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭任务详情' }));
    dialog = await openTaskDetail('目标任务');
    fireEvent.click(within(dialog).getByRole('button', { name: '记录完成' }));
    await within(dialog).findByText(/已提交完成记录/);
    expect(server.entries.get(43)!.status).toBe('active');
    await waitFor(() => {
      expect(within(dialog).getByText('本周期完成数').parentElement).toHaveTextContent(/本周期完成数\s*1/);
    });
    expect(within(region).getByText('目标任务')).toBeInTheDocument();
  });

  it('keeps the completion note and canonical state on a 503 and never double-sends a pending click', async () => {
    const { server, calls } = installTaskServer([taskEntry({ id: 41, title: '完成记录任务', entry_type: 'todo' })]);
    let finish!: (response: Response) => void;
    server.complete = () => new Promise((resolve) => { finish = resolve; });
    await renderRiver();
    const dialog = await openTaskDetail('完成记录任务');
    fireEvent.change(within(dialog).getByLabelText(/完成备注/), { target: { value: '保留的完成备注' } });
    const complete = within(dialog).getByRole('button', { name: '记录完成' });
    fireEvent.click(complete);
    fireEvent.click(complete);
    const completes = () => posts(calls).filter((call) => call.url.pathname === '/api/tasks/entries/41/complete/');
    await waitFor(() => expect(completes()).toHaveLength(1));
    expect(within(dialog).getByRole('button', { name: '记录完成中…' })).toBeDisabled();

    await act(async () => { finish(jsonResponse({ detail: '完成记录写入失败' }, 503)); });
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('完成记录写入失败');
    expect(alert).toHaveTextContent(/操作结果不确定，请先刷新核对；本次不会自动重试。/);
    expect(within(dialog).getByLabelText(/完成备注/)).toHaveValue('保留的完成备注');
    expect(server.entries.get(41)!.status).toBe('active');
    expect(server.completions.size).toBe(0);
    expect(within(dialog).getByText('进行中')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '记录完成' })).toBeEnabled();
    expect(completes()).toHaveLength(1);
  });

  it('suspend clears the pin from the source; resume only re-reads status', async () => {
    const { server } = installTaskServer([
      taskEntry({ id: 41, title: '置顶任务', entry_type: 'todo', is_pinned: true }),
    ]);
    const region = await renderRiver();
    const dialog = await openTaskDetail('置顶任务');
    expect(within(dialog).getByText('已置顶')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '暂停任务' }));
    await within(dialog).findByText(/已暂停该任务/);
    expect(server.entries.get(41)!.status).toBe('suspended');
    expect(server.entries.get(41)!.is_pinned).toBe(false);
    expect(within(dialog).getByText('已暂停')).toBeInTheDocument();
    expect(within(dialog).queryByText('已置顶')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '记录完成' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/任务已暂停，恢复后可继续记录完成/)).toBeInTheDocument();
    expect(within(region).queryByText('置顶任务')).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '恢复任务' }));
    await within(dialog).findByText(/已恢复为进行中/);
    expect(server.entries.get(41)!.status).toBe('active');
    expect(server.entries.get(41)!.is_pinned).toBe(false);
    expect(within(dialog).getByText('进行中')).toBeInTheDocument();
    await waitFor(() => expect(within(region).getByText('置顶任务')).toBeInTheDocument());
  });

  it('archive cancels without DELETE, then confirms a soft archive through DELETE 204', async () => {
    const { server, calls } = installTaskServer([taskEntry({ id: 41, title: '待归档', entry_type: 'todo' })]);
    await renderRiver();
    const dialog = await openTaskDetail('待归档');
    fireEvent.click(within(dialog).getByRole('button', { name: '归档（软归档）' }));
    const confirm = within(dialog).getByRole('alert');
    expect(confirm).toHaveTextContent('软归档，数据保留');
    fireEvent.click(within(confirm).getByRole('button', { name: '取消归档' }));
    expect(deletes(calls)).toHaveLength(0);
    expect(within(dialog).queryByText(/软归档，数据保留/)).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '归档（软归档）' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认归档' }));
    await within(dialog).findByText(/已软归档（archived）/);
    expect(server.entries.get(41)!.status).toBe('archived');
    expect(server.entries.has(41)).toBe(true);
    const removed = deletes(calls);
    expect(removed).toHaveLength(1);
    expect(removed[0].url.pathname).toBe('/api/tasks/entries/41/');
    expect(within(dialog).getByText('已归档')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '归档（软归档）' })).not.toBeInTheDocument();
  });

  it('postpones a todo through due_date PATCH and routes periodic/goal to their native fields', async () => {
    const { server, calls } = installTaskServer([
      taskEntry({ id: 41, title: '截止任务', entry_type: 'todo', due_date: '2026-10-02' }),
      taskEntry({ id: 42, title: '周期编辑', entry_type: 'periodic', interval_unit: 'day', interval_value: 1, end_type: 'never' }),
      taskEntry({ id: 43, title: '目标编辑', entry_type: 'goal', goal_count: 2, goal_period: 'week', cycle_start: '2026-09-28', cycle_due: '2026-10-04' }),
    ]);
    await renderRiver();

    let dialog = await openTaskDetail('截止任务');
    fireEvent.click(within(dialog).getByRole('button', { name: '延期到明天' }));
    await within(dialog).findByText(/已延期到明天/);
    expect(JSON.parse(String(patches(calls)[0].init?.body))).toEqual({ due_date: plusDays(1) });
    fireEvent.click(within(dialog).getByRole('button', { name: '延期到下周' }));
    await within(dialog).findByText(/已延期到下周/);
    expect(JSON.parse(String(patches(calls)[1].init?.body))).toEqual({ due_date: plusDays(7) });
    expect(server.entries.get(41)!.due_date).toBe(plusDays(7));
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭任务详情' }));

    dialog = await openTaskDetail('周期编辑');
    expect(within(dialog).queryByRole('button', { name: '延期到明天' })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/周期任务没有单一 due_date 可延期/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '打开原生编辑表单' }));
    const periodicForm = await screen.findByRole('dialog');
    expect(within(periodicForm).getByRole('region', { name: '周期设置' })).toBeInTheDocument();
    fireEvent.click(within(periodicForm).getByRole('button', { name: '保存修改' }));
    await screen.findByRole('heading', { name: '任务详情 · 周期编辑' });
    const periodicBody = JSON.parse(
      String(patches(calls).find((call) => call.url.pathname === '/api/tasks/entries/42/')!.init?.body),
    ) as Record<string, unknown>;
    expect(periodicBody).toMatchObject({ interval_unit: 'day', interval_value: 1, end_type: 'never' });
    expect(periodicBody).not.toHaveProperty('due_date');

    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭任务详情' }));
    dialog = await openTaskDetail('目标编辑');
    expect(within(dialog).getByText(/cycle_start \/ cycle_due/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '打开原生编辑表单' }));
    const goalForm = await screen.findByRole('dialog');
    expect(within(goalForm).getByRole('region', { name: '目标设置' })).toBeInTheDocument();
    fireEvent.click(within(goalForm).getByRole('button', { name: '保存修改' }));
    await screen.findByRole('heading', { name: '任务详情 · 目标编辑' });
    const goalBody = JSON.parse(
      String(patches(calls).find((call) => call.url.pathname === '/api/tasks/entries/43/')!.init?.body),
    ) as Record<string, unknown>;
    expect(goalBody).toMatchObject({
      goal_count: 2,
      goal_period: 'week',
      cycle_start: '2026-09-28',
      cycle_due: '2026-10-04',
    });
    expect(goalBody).not.toHaveProperty('due_date');
  });

  it('shows a GCal push failure, never claims remote sync after local PATCH, and unlinks honestly', async () => {
    const { server, calls } = installTaskServer([taskEntry({ id: 41, title: '同步任务', entry_type: 'todo' })]);
    server.push = () => jsonResponse({ detail: 'GCal sync failed: quota exceeded', gcal_synced: false }, 502);
    await renderRiver();
    const dialog = await openTaskDetail('同步任务');
    expect(within(dialog).getByText(/未关联 GCal/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '推送到 Google Calendar' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'GCal 推送失败：GCal sync failed: quota exceeded',
    );
    expect(within(dialog).queryByText('已推送至 Google Calendar。')).not.toBeInTheDocument();
    expect(server.entries.get(41)!.gcal_event_id).toBe('');

    server.push = undefined;
    fireEvent.click(within(dialog).getByRole('button', { name: '推送到 Google Calendar' }));
    await within(dialog).findByText('已推送至 Google Calendar。');
    expect(server.entries.get(41)!.gcal_event_id).not.toBe('');
    expect(within(dialog).getByText(/本地记录已关联 GCal/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '编辑任务' }));
    const form = await screen.findByRole('dialog');
    fireEvent.change(within(form).getByLabelText(/标题/), { target: { value: '同步任务改' } });
    fireEvent.click(within(form).getByRole('button', { name: '保存修改' }));
    await screen.findByRole('heading', { name: '任务详情 · 同步任务改' });
    expect(screen.queryByText(/远端同步成功|已同步到 Google/)).not.toBeInTheDocument();
    expect(screen.getByText(/PATCH 200 只代表本地记录更新/)).toBeInTheDocument();

    const detail = screen.getByRole('dialog');
    fireEvent.click(within(detail).getByRole('button', { name: '解除 GCal 关联' }));
    await within(detail).findByText(/本地 GCal 关联已清除/);
    expect(deletes(calls).some((call) => call.url.pathname === '/api/tasks/entries/41/gcal/')).toBe(true);
    expect(server.entries.get(41)!.gcal_event_id).toBe('');
    expect(within(detail).queryByText(/远端事件已删除/)).not.toBeInTheDocument();
    expect(within(detail).getByText(/未关联 GCal/)).toBeInTheDocument();
  });

  it('keeps the GCal link and shows the real unlink failure without claiming removal', async () => {
    const { server, calls } = installTaskServer([
      taskEntry({
        id: 41,
        title: '解绑失败任务',
        entry_type: 'todo',
        gcal_event_id: 'evt_41',
        gcal_event_link: 'https://calendar.google.com/event?eid=evt_41',
      }),
    ]);
    server.unlink = () => jsonResponse({ detail: 'GCal unlink failed: invalid_grant' }, 502);
    await renderRiver();
    const dialog = await openTaskDetail('解绑失败任务');
    expect(within(dialog).getByText(/本地记录已关联 GCal/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: '解除 GCal 关联' }));
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('解除 GCal 关联失败：GCal unlink failed: invalid_grant');
    expect(alert).not.toHaveTextContent(/已清除/);
    // The failed DELETE left canonical link fields untouched; the UI never
    // optimistically unlinked or claimed a local/remote removal.
    expect(server.entries.get(41)!.gcal_event_id).toBe('evt_41');
    expect(server.entries.get(41)!.gcal_event_link).toBe('https://calendar.google.com/event?eid=evt_41');
    expect(within(dialog).getByText(/本地记录已关联 GCal/)).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: '在 Google Calendar 打开' })).toHaveAttribute(
      'href',
      'https://calendar.google.com/event?eid=evt_41',
    );
    expect(within(dialog).getByRole('button', { name: '解除 GCal 关联' })).toBeEnabled();
    expect(deletes(calls).filter((call) => call.url.pathname === '/api/tasks/entries/41/gcal/')).toHaveLength(1);
  });

  it('blocks duplicate creates and keeps a definite 400 failure input editable', async () => {
    const { server, calls } = installTaskServer();
    await renderRiver();
    const dialog = await openTaskForm();
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    expect(await within(dialog).findByText('标题不能为空。')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(0);

    server.create = () => jsonResponse({ title: ['标题不合法'] }, 400);
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '保留标题' } });
    const create = within(dialog).getByRole('button', { name: '创建任务' });
    fireEvent.click(create);
    fireEvent.click(create);
    expect(await within(dialog).findByText('标题不合法')).toBeInTheDocument();
    expect(posts(calls)).toHaveLength(1);
    expect(within(dialog).getByLabelText(/标题/)).toHaveValue('保留标题');

    server.create = undefined;
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts(calls)).toHaveLength(2);
  });
});

describe('CP3 mutation refresh', () => {
  it('restarts the River home traversal on create/complete but keeps paged windows on updates', async () => {
    const { server, calls } = installTaskServer([taskEntry({ id: 41, title: '基线任务', entry_type: 'todo' })]);
    server.riverNextCursor = 'cursor-old';
    server.riverMoreItems = [memoItem];
    await renderRiver();
    await waitFor(() => expect(riverHomes(calls)).toHaveLength(1));

    fireEvent.click(await screen.findByRole('button', { name: '加载更早记录' }));
    await screen.findByText('根 Memo #task');
    expect(riverCursors(calls)).toHaveLength(1);

    // Update: the created event does not move, so the open cursor window is re-read in place.
    let dialog = await openTaskDetail('基线任务');
    fireEvent.click(within(dialog).getByRole('button', { name: '延期到明天' }));
    await within(dialog).findByText(/已延期到明天/);
    await waitFor(() => expect(riverCursors(calls)).toHaveLength(2));
    expect(riverHomes(calls)).toHaveLength(2);
    expect(screen.getByText('根 Memo #task')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '关闭任务详情' }));

    // Create: a new event lands at the home boundary, so the traversal restarts from page one.
    dialog = await openTaskForm();
    fireEvent.change(within(dialog).getByLabelText(/标题/), { target: { value: '新任务刷新' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建任务' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const region = await shelf();
    await waitFor(() => expect(within(region).getByText('新任务刷新')).toBeInTheDocument());
    await waitFor(() => expect(riverHomes(calls)).toHaveLength(3));
    expect(riverCursors(calls)).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText('根 Memo #task')).not.toBeInTheDocument());
    await screen.findByText('任务创建 · 新任务刷新');

    // Complete: another home-boundary event; the completion is visible after the restart.
    dialog = await openTaskDetail('新任务刷新');
    fireEvent.click(within(dialog).getByRole('button', { name: '记录完成' }));
    await within(dialog).findByText(/已提交完成记录/);
    await waitFor(() => expect(riverHomes(calls)).toHaveLength(4));
    await screen.findByText('任务完成 · 新任务刷新');
  });
});

describe('CP3 Calendar companion', () => {
  it('shows real metadata, folds exclusive ends, distinguishes timed rows, and opens canonical tasks', async () => {
    const today = localDateString();
    const windowStart = plusDays(-2);
    const windowEnd = plusDays(30);
    const meetingStart = localIso(today, 9, 30);
    const meetingEnd = localIso(today, 10, 30);
    const meetingStartUtc = new Date(meetingStart).toISOString();
    const meetingEndUtc = new Date(meetingEnd).toISOString();
    const { server, calls } = installTaskServer([
      taskEntry({ id: 41, title: '日历任务', entry_type: 'todo', start_date: today, due_date: today }),
      taskEntry({ id: 43, title: '快照外目标', entry_type: 'goal', goal_count: 2, goal_period: 'week', cycle_start: today, cycle_due: plusDays(7) }),
    ]);
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: windowStart,
      window_end: windowEnd,
      events: [
        calendarEvent({
          id: 'exo_41',
          source: 'exocore',
          title: '[ExoCore] 日历任务',
          start: today,
          end: plusDays(2),
          all_day: true,
          description: '本地来源',
          entry_type: 'todo',
          status: 'active',
          exocore_entry_id: 41,
        }),
        calendarEvent({
          id: 'gcal-1',
          source: 'gcal',
          title: '纯 GCal 会议',
          start: meetingStart,
          end: meetingEnd,
          all_day: false,
          location: '会议室',
          html_link: 'https://calendar.google.com/event?eid=1',
          calendar_name: 'Primary',
          calendar_id: 'primary',
        }),
        calendarEvent({
          id: 'gcal-utc',
          source: 'gcal',
          title: '同一时刻（UTC 表示）',
          start: meetingStartUtc,
          end: meetingEndUtc,
          all_day: false,
          html_link: 'https://calendar.google.com/event?eid=2',
          calendar_name: 'Primary',
          calendar_id: 'primary',
        }),
      ],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: plusDays(1),
      events: [],
    });

    await renderRiver();
    const calendar = await openCalendar();
    expect(await within(calendar).findByText(new RegExp(`覆盖 ${windowStart} → ${windowEnd}（含当日）· 共 3 条`))).toBeInTheDocument();
    // Both the 90-day and the 48h snapshot intentionally share this fixture's
    // fetched_at, so both metadata lines must render (scoped to this dialog).
    expect(
      within(calendar).getAllByText((content) => content.includes(`生成时间：${new Date('2026-10-02T07:00:00Z').toLocaleString()}`)),
    ).toHaveLength(2);
    expect(await within(calendar).findByText('今日在快照覆盖范围内，暂无事件。')).toBeInTheDocument();

    const daySection = await within(calendar).findByRole('region', { name: '选中日事件' });
    const exoRow = within(daySection).getByText('[ExoCore] 日历任务').closest('li')!;
    expect(within(exoRow).getByText('ExoCore · 待办 · 进行中')).toBeInTheDocument();
    expect(within(exoRow).getByText(`日期 ${today} → ${plusDays(2)}（全天，结束日排他）`)).toBeInTheDocument();
    expect(within(exoRow).getByText('本地来源')).toBeInTheDocument();

    const gcalRow = within(daySection).getByText('纯 GCal 会议').closest('li')!;
    expect(within(gcalRow).getByText('09:30')).toBeInTheDocument();
    expect(within(gcalRow).getByText('GCal · Primary（只读，不可编辑 Task）')).toBeInTheDocument();
    expect(within(gcalRow).getByText(`本地时区 ${today} 09:30 → ${today} 10:30 · 来源偏移 ${meetingStart.slice(19)} · 原始 ${meetingStart} → ${meetingEnd}`)).toBeInTheDocument();
    expect(within(gcalRow).getByRole('link', { name: '在 Google Calendar 打开' })).toHaveAttribute(
      'href',
      'https://calendar.google.com/event?eid=1',
    );
    expect(within(gcalRow).queryByRole('button', { name: '打开任务详情' })).not.toBeInTheDocument();

    // The same instants written as UTC show the same local clock and range.
    const utcRow = within(daySection).getByText('同一时刻（UTC 表示）').closest('li')!;
    expect(within(utcRow).getByText('09:30')).toBeInTheDocument();
    expect(within(utcRow).getByText(`本地时区 ${today} 09:30 → ${today} 10:30 · 来源偏移 Z · 原始 ${meetingStartUtc} → ${meetingEndUtc}`)).toBeInTheDocument();

    fireEvent.click(within(exoRow).getByRole('button', { name: '打开任务详情' }));
    const detail = await screen.findByRole('dialog');
    await within(detail).findByRole('heading', { name: '任务详情 · 日历任务' });
    expect(calls.some((call) => call.url.pathname === '/api/tasks/entries/41/' && call.init?.method === 'GET')).toBe(true);
    fireEvent.click(within(detail).getByRole('button', { name: '关闭任务详情' }));
    await screen.findByRole('heading', { name: '日历陪伴视图' });

    // End date is exclusive: the all-day event covers today and tomorrow, not the day after.
    const reopened = screen.getByRole('dialog');
    fireEvent.click(within(reopened).getByRole('button', { name: `${plusDays(1)}，1 条事件` }));
    const tomorrowList = within(reopened).getByRole('region', { name: '选中日事件' });
    expect(within(tomorrowList).getByText('[ExoCore] 日历任务')).toBeInTheDocument();
    expect(within(tomorrowList).queryByText('纯 GCal 会议')).not.toBeInTheDocument();
    fireEvent.click(within(reopened).getByRole('button', { name: `${plusDays(2)}，0 条事件` }));
    const afterList = within(reopened).getByRole('region', { name: '选中日事件' });
    expect(within(afterList).getByText('该日期在快照覆盖范围内，暂无事件。')).toBeInTheDocument();
    expect(within(afterList).queryByText('[ExoCore] 日历任务')).not.toBeInTheDocument();

    // The full list still exposes goal tasks that the snapshot deliberately excludes.
    const list = within(reopened).getByRole('region', { name: '全量任务列表' });
    const goalRow = within(list).getByText('快照外目标').closest('li')!;
    expect(within(goalRow).getByText(/目标 · 进行中/)).toBeInTheDocument();
    fireEvent.click(within(goalRow).getByRole('button', { name: '打开任务详情' }));
    const goalDetail = await screen.findByRole('dialog');
    await within(goalDetail).findByRole('heading', { name: '任务详情 · 快照外目标' });
    expect(within(goalDetail).getByText(/每周 2 次/)).toBeInTheDocument();
  });

  it('treats days outside the snapshot window as not covered, never as empty', async () => {
    const { server } = installTaskServer();
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2020-02-10T07:00:00Z',
      window_start: '2020-02-10',
      window_end: '2020-03-10',
      events: [],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2020-02-10T07:00:00Z',
      window_start: '2020-02-10',
      window_end: '2020-02-12',
      events: [],
    });
    await renderRiver();
    const calendar = await openCalendar();
    expect(await within(calendar).findByRole('button', { name: '2020-02-01，不在快照覆盖范围' })).toBeDisabled();
    expect(within(calendar).getByRole('button', { name: '2020-02-15，0 条事件' })).toBeEnabled();
    fireEvent.click(within(calendar).getByRole('button', { name: '2020-02-15，0 条事件' }));
    expect(within(calendar).getByRole('heading', { name: '2020-02-15' })).toBeInTheDocument();
    expect(within(calendar).getByText('该日期在快照覆盖范围内，暂无事件。')).toBeInTheDocument();
    expect(within(calendar).getByText('该快照窗口未覆盖今天（未覆盖 ≠ 今天没有日程）。')).toBeInTheDocument();
    expect(within(calendar).queryByText('今日在快照覆盖范围内，暂无事件。')).not.toBeInTheDocument();
  });

  it('keeps a 503 snapshot explicitly unavailable and recovers on retry', async () => {
    const { server } = installTaskServer([
      taskEntry({ id: 43, title: '仍可操作目标', entry_type: 'goal', goal_count: 1, goal_period: 'week' }),
    ]);
    server.calendarError = 503;
    server.todayError = 503;
    await renderRiver();
    const calendar = await openCalendar();
    expect(
      await within(calendar).findByText(/日历快照尚不可用（后台尚未生成或文件缺失）。这不代表该区间没有任何日程。/),
    ).toBeInTheDocument();
    expect(
      within(calendar).getByText(/今日快照尚不可用（后台尚未生成或文件缺失）。这不代表今天没有任何日程。/),
    ).toBeInTheDocument();
    expect(within(calendar).queryByRole('group', { name: '月份栅格' })).not.toBeInTheDocument();
    expect(within(calendar).queryByText(/该日期在快照覆盖范围内/)).not.toBeInTheDocument();
    const list = within(calendar).getByRole('region', { name: '全量任务列表' });
    await within(list).findByText('仍可操作目标');

    server.calendarError = undefined;
    server.todayError = undefined;
    server.calendarSnapshot = calendarSnapshot({ window_start: '2020-02-10', window_end: '2020-03-10', events: [] });
    server.todaySnapshot = calendarSnapshot({ window_start: '2020-02-10', window_end: '2020-02-12', events: [] });
    fireEvent.click(within(calendar).getByRole('button', { name: '重新读取日历快照' }));
    await within(calendar).findByText(/覆盖 2020-02-10 → 2020-03-10（含当日）· 共 0 条/);
    fireEvent.click(within(calendar).getByRole('button', { name: '重新读取今日快照' }));
    await within(calendar).findByText(/覆盖 2020-02-10 → 2020-02-12 · 共 0 条/);
  });

  it('maps an all-day range longer than 120 days across the visible snapshot window', async () => {
    const { server } = installTaskServer();
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2020-01-01T07:00:00Z',
      window_start: '2020-01-01',
      window_end: '2020-12-31',
      events: [
        calendarEvent({
          id: 'long-event',
          source: 'gcal',
          title: '跨年长假',
          start: '2019-07-01',
          end: '2021-01-01',
          all_day: true,
          description: '长事件',
        }),
      ],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2020-01-01T07:00:00Z',
      window_start: '2020-01-01',
      window_end: '2020-01-03',
      events: [],
    });
    await renderRiver();
    const calendar = await openCalendar();
    // The old implementation capped the mapping at 120 days, so this January
    // day (208 days after the event start) would have shown zero events.
    expect(await within(calendar).findByRole('button', { name: '2020-01-25，1 条事件' })).toBeEnabled();
    expect(within(calendar).getByRole('button', { name: '2020-01-01，1 条事件' })).toBeEnabled();
    const section = within(calendar).getByRole('region', { name: '选中日事件' });
    expect(within(section).getByText('跨年长假')).toBeInTheDocument();
    expect(within(section).getByText('日期 2019-07-01 → 2021-01-01（全天，结束日排他）')).toBeInTheDocument();
    expect(within(section).getByText('长事件')).toBeInTheDocument();
  });

  it('keeps a timed event ending exactly at local midnight on its start day only', async () => {
    const today = localDateString();
    const tomorrow = plusDays(1);
    const start = localIso(today, 22);
    const end = localIso(tomorrow, 0);
    const { server } = installTaskServer();
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: plusDays(10),
      events: [
        calendarEvent({ id: 'overnight-1', source: 'gcal', title: '通宵值守', start, end, all_day: false }),
      ],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: tomorrow,
      events: [],
    });
    await renderRiver();
    const calendar = await openCalendar();
    expect(await within(calendar).findByRole('button', { name: `${today}，1 条事件` })).toBeEnabled();
    expect(within(calendar).getByRole('button', { name: `${tomorrow}，0 条事件` })).toBeEnabled();
    const section = within(calendar).getByRole('region', { name: '选中日事件' });
    expect(within(section).getByText('通宵值守')).toBeInTheDocument();
    expect(
      within(section).getByText(`本地时区 ${today} 22:00 → ${tomorrow} 00:00 · 来源偏移 ${start.slice(19)} · 原始 ${start} → ${end}`),
    ).toBeInTheDocument();
  });

  it('re-reads a healthy snapshot on demand without rebuilding it', async () => {
    const today = localDateString();
    const { server, calls } = installTaskServer();
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: plusDays(30),
      events: [],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: plusDays(2),
      events: [],
    });
    await renderRiver();
    const calendar = await openCalendar();
    const calendarGets = () => calls.filter((call) => call.url.pathname === '/api/tasks/calendar/');
    expect(await within(calendar).findByText(new RegExp(`覆盖 ${today} → ${plusDays(30)}（含当日）· 共 0 条`))).toBeInTheDocument();
    expect(calendarGets()).toHaveLength(1);

    server.calendarSnapshot = { ...server.calendarSnapshot, fetched_at: '2026-10-02T15:30:00Z' };
    fireEvent.click(within(calendar).getByRole('button', { name: '重新读取快照' }));
    await waitFor(() => expect(calendarGets()).toHaveLength(2));
    expect(
      await within(calendar).findByText((content) => content.includes(
        `生成时间：${new Date('2026-10-02T15:30:00Z').toLocaleString()}`,
      )),
    ).toBeInTheDocument();
  });

  it('keeps the same fetched_at and sends no rebuild POST on a successful snapshot refetch', async () => {
    const today = localDateString();
    const { server, calls } = installTaskServer();
    server.calendarSnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T07:00:00Z',
      window_start: today,
      window_end: plusDays(30),
      events: [],
    });
    server.todaySnapshot = calendarSnapshot({
      fetched_at: '2026-10-02T06:00:00Z',
      window_start: today,
      window_end: plusDays(2),
      events: [],
    });
    await renderRiver();
    const calendar = await openCalendar();
    const generated = `生成时间：${new Date('2026-10-02T07:00:00Z').toLocaleString()}`;
    expect(await within(calendar).findByText((content) => content.includes(generated))).toBeInTheDocument();
    const calendarGets = () => calls.filter((call) => call.url.pathname === '/api/tasks/calendar/');
    expect(calendarGets()).toHaveLength(1);

    fireEvent.click(within(calendar).getByRole('button', { name: '重新读取快照' }));
    await waitFor(() => expect(calendarGets()).toHaveLength(2));
    // A successful refetch re-serves the file's own fetched_at; the client
    // neither rewrites it nor POSTs a background-job rebuild.
    expect(within(calendar).getByText((content) => content.includes(generated))).toBeInTheDocument();
    expect(posts(calls).filter((call) => call.url.pathname.startsWith('/api/tasks/'))).toHaveLength(0);
  });
});
