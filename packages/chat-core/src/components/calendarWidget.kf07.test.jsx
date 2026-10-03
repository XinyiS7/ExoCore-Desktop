import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('exo-shared', () => ({
  tasksApi: {
    listTasks: vi.fn(), getCalendarSnapshot: vi.fn(), createTask: vi.fn(),
    completeTask: vi.fn(), deleteTask: vi.fn(),
  },
}));
import { tasksApi } from 'exo-shared';
import CalendarWidget from '../../../chronicle/src/components/CalendarWidget.jsx';

const localIso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const entry = (payload) => ({ ...payload, id: 71, status: 'active' });
async function openForm() {
  render(<CalendarWidget />);
  await waitFor(() => expect(screen.queryByText('加载中...')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: '新建待办' }));
  fireEvent.change(screen.getByPlaceholderText('任务标题...'), { target: { value: '  回归待办  ' } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-04-20T22:30:00Z'));
  tasksApi.listTasks.mockResolvedValue([]);
  tasksApi.getCalendarSnapshot.mockResolvedValue({ events: [] });
  tasksApi.createTask.mockImplementation(async (payload) => entry(payload));
  // A missing mock must not silently reach a real backend.
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in KF07 regression'); }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('KF07 V3 CalendarWidget quick create', () => {
  it.each(['2026-04-20T02:30:00Z', '2026-04-20T22:30:00Z'])('maps runtime local today and blank description at %s', async (instant) => {
    vi.setSystemTime(new Date(instant));
    const today = localIso(new Date());
    await openForm();
    expect(screen.getByText('今日任务')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledTimes(1));
    expect(tasksApi.createTask).toHaveBeenCalledWith({
      title: '回归待办', entry_type: 'todo', start_date: today, due_date: today, description: '',
    });
    await waitFor(() => expect(screen.queryByPlaceholderText('任务标题...')).not.toBeInTheDocument());
    expect(screen.getByText('回归待办')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps selected day as due_date, not start_date; custom deadline overrides selection', async () => {
    await openForm();
    fireEvent.click(screen.getByRole('button', { name: '25', exact: true }));
    expect(screen.getByLabelText('截止日期')).toHaveValue('2026-04-25');
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledTimes(1));
    expect(tasksApi.createTask.mock.calls[0][0]).toMatchObject({ start_date: localIso(new Date()), due_date: '2026-04-25', description: '' });
    await waitFor(() => expect(screen.queryByPlaceholderText('任务标题...')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '新建待办' }));
    expect(screen.getByPlaceholderText('任务标题...')).toHaveValue('');
    fireEvent.change(screen.getByPlaceholderText('任务标题...'), { target: { value: '自选截止' } });
    fireEvent.change(screen.getByLabelText('截止日期'), { target: { value: '2026-05-09' } });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledTimes(2));
    expect(tasksApi.createTask.mock.calls[1][0]).toMatchObject({ start_date: localIso(new Date()), due_date: '2026-05-09' });
  });

  it('computes start_date at submission even when the form spans midnight', async () => {
    vi.setSystemTime(new Date(2026, 3, 20, 23, 59));
    await openForm();
    vi.setSystemTime(new Date(2026, 3, 21, 0, 1));
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalledTimes(1));
    expect(tasksApi.createTask.mock.calls[0][0]).toMatchObject({ start_date: '2026-04-21', due_date: '2026-04-20' });
  });

  it('blocks click/Enter reentry and editing/cancel while pending; success clears the form', async () => {
    let resolve;
    tasksApi.createTask.mockImplementation((payload) => new Promise((done) => { resolve = () => done(entry(payload)); }));
    await openForm();
    const input = screen.getByPlaceholderText('任务标题...');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: '添加中...' }));
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);
    expect(input).toBeDisabled();
    expect(screen.getByLabelText('截止日期')).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '新建待办' })).toBeDisabled();
    resolve();
    await waitFor(() => expect(screen.queryByPlaceholderText('任务标题...')).not.toBeInTheDocument());
    expect(screen.getByText('回归待办')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建待办' })).not.toBeDisabled();
  });

  it('shows rejected POST visibly, retains title/deadline, and releases guard for explicit resubmission', async () => {
    tasksApi.createTask.mockRejectedValueOnce(Object.assign(new Error('API 400'), { status: 400, body: { title: ['Invalid'] } }));
    await openForm();
    fireEvent.change(screen.getByLabelText('截止日期'), { target: { value: '2026-05-11' } });
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('任务创建失败');
    expect(screen.getByPlaceholderText('任务标题...')).toHaveValue('  回归待办  ');
    expect(screen.getByLabelText('截止日期')).toHaveValue('2026-05-11');
    expect(screen.getByRole('button', { name: '添加' })).not.toBeDisabled();
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('任务标题...')).not.toBeInTheDocument());
    expect(tasksApi.createTask).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['network', new TypeError('Failed to fetch')],
    ['server', Object.assign(new Error('API 503'), { status: 503 })],
  ])('warns uncertain %s results without automatic POST retry or input loss', async (_name, error) => {
    tasksApi.createTask.mockRejectedValueOnce(error);
    await openForm();
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存结果不确定，请先刷新核对任务列表');
    expect(screen.getByRole('alert')).toHaveTextContent('避免重复创建');
    expect(screen.getByPlaceholderText('任务标题...')).toHaveValue('  回归待办  ');
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);
  });

  it('does not treat an unconfirmed success response as a created entry', async () => {
    tasksApi.createTask.mockResolvedValueOnce({});
    await openForm();
    fireEvent.click(screen.getByRole('button', { name: '添加' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('保存结果不确定');
    expect(screen.getByPlaceholderText('任务标题...')).toHaveValue('  回归待办  ');
    expect(screen.queryByText('回归待办')).not.toBeInTheDocument();
    expect(tasksApi.createTask).toHaveBeenCalledTimes(1);
  });

  it('rejects whitespace titles and ignores Enter during composition', async () => {
    await openForm();
    const input = screen.getByPlaceholderText('任务标题...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
    expect(tasksApi.createTask).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '输入法' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(tasksApi.createTask).not.toHaveBeenCalled();
  });
});
