import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationPage } from "../features/chat/ConversationPage";
import * as storage from "../features/chat/runtime/storage";
import {
  installRuntimeFetch, jsonResponse, renderApp, runtimeTestPreset, selectRuntimeTransport, unmockFetch,
} from "./helpers";

const conversation = (id: number) => ({
  id, name: `Conversation ${id}`, created_at: "2026-09-01T10:00:00Z", frozen_project_ids: [],
  project: 0, project_name: null, agent_type: "standard", agent_preset_id: 5,
  last_message_at: "2026-09-01T10:00:00Z", thinking_level: "auto", memory_injection_enabled: null,
  is_prime: false,
});
const message = (id: number, role: string, content: string, index: number) => ({
  id, role, content, reasoning_content: null, platform: "deepseek", model_version: "v4-flash",
  token_count: null, index_in_session: index, attachment_ids: [], attachments_meta: null,
  created_at: "2026-09-01T10:00:00Z",
});
const doneResponse = (status = "done") => jsonResponse({
  status, events: [{ event_type: "content", delta: "第二段" }], cursor: 2,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
let visibility: DocumentVisibilityState;
function setVisibility(value: DocumentVisibilityState) {
  visibility = value;
  fireEvent(document, new Event("visibilitychange"));
}
function foregroundBurst() {
  fireEvent(document, new Event("visibilitychange"));
  fireEvent(window, new Event("focus"));
  fireEvent(window, new Event("pageshow"));
  fireEvent(window, new Event("online"));
}
beforeEach(() => {
  window.localStorage.clear();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
});
afterEach(() => {
  vi.restoreAllMocks();
  unmockFetch();
  window.localStorage.clear();
});

/** Real ConversationPage + runtime/client/query/storage; only HTTP is simulated. */
function installRun(options: {
  failedPoll?: () => Response | Promise<Response>;
  resumedPoll?: () => Response | Promise<Response>;
  ack?: Record<string, unknown>;
} = {}) {
  const stats = { posts: 0, stops: 0, requests: [] as { cursor: number; token: string | null }[],
    active: 0, maxActive: 0, canonicalReads: 0, signals: [] as AbortSignal[] };
  installRuntimeFetch([
    { test: "/api/agents/presets/", handler: () => jsonResponse([runtimeTestPreset(5)]) },
    { test: "/api/agents/conversations/63/", handler: () => jsonResponse(conversation(63)) },
    { test: "/api/agents/conversations/64/", handler: () => jsonResponse(conversation(64)) },
    { test: "/api/agents/chat/63/stop/", method: "POST", handler: () => {
      stats.stops += 1;
      return jsonResponse({ status: "stop_requested" });
    } },
    { test: "/api/agents/chat/63/", method: "POST", handler: () => {
      stats.posts += 1;
      return jsonResponse(options.ack ?? { message_id: "tok63abc", status: "processing" });
    } },
    { test: "/api/agents/chat/63/status/", handler: async (url, init) => {
      stats.requests.push({ cursor: Number(url.searchParams.get("cursor")), token: url.searchParams.get("message_id") });
      if (init?.signal) stats.signals.push(init.signal);
      stats.active += 1;
      stats.maxActive = Math.max(stats.maxActive, stats.active);
      try {
        if (stats.requests.length === 1) {
          return jsonResponse({ status: "processing", events: [{ event_type: "content", delta: "第一段" }], cursor: 1 });
        }
        if (stats.requests.length === 2) {
          if (options.failedPoll) return await options.failedPoll();
          throw new TypeError("Failed to fetch");
        }
        return options.resumedPoll ? await options.resumedPoll() : doneResponse();
      } finally { stats.active -= 1; }
    } },
    { test: "/api/agents/chat/63/", handler: () => {
      const complete = stats.requests.length >= 3;
      if (complete) stats.canonicalReads += 1;
      return jsonResponse({ messages: complete
        ? [message(630, "user", "恢复测试", 0), message(631, "assistant", "第一段第二段", 1)] : [],
      total_count: complete ? 2 : 0, has_more: false });
    } },
    { test: "/api/agents/chat/64/", handler: () => jsonResponse({
      messages: [message(640, "assistant", "64 的历史", 0)], total_count: 1, has_more: false,
    }) },
  ]);
  return stats;
}
async function send() {
  await selectRuntimeTransport("async");
  const input = await screen.findByRole("textbox", { name: /消息输入框/ });
  fireEvent.change(input, { target: { value: "恢复测试" } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
  await waitFor(() => {
    const lease = storage.readRuntimeLease(63);
    expect(lease.state === "valid" && lease.lease.cursor).toBe(1);
  });
}
async function paused() {
  await screen.findByRole("button", { name: "继续轮询" });
}
async function assertComplete(stats: ReturnType<typeof installRun>) {
  await waitFor(() => {
    expect(screen.getAllByText("第一段第二段")).toHaveLength(1);
    expect(storage.readRuntimeLease(63).state).toBe("absent");
  });
  expect(screen.queryByRole("button", { name: "继续轮询" })).toBeNull();
  expect(screen.queryByText(/网络连接异常/)).toBeNull();
  expect(screen.queryByRole("button", { name: /停止生成/ })).toBeNull();
  expect(stats.posts).toBe(1);
  expect(stats.requests).toEqual([
    { cursor: 0, token: "tok63abc" }, { cursor: 1, token: "tok63abc" }, { cursor: 1, token: "tok63abc" },
  ]);
  expect(stats.maxActive).toBe(1);
  expect(stats.canonicalReads).toBe(1);
}

describe("LR-01 foreground exact async recovery", () => {
  it.each(["visibilitychange", "focus", "pageshow", "online"])(
    "visible %s resumes retained cursor and reconciles once without a second POST", async (event) => {
      const stats = installRun();
      renderApp(["/chat/63"]);
      await send();
      setVisibility("hidden");
      await paused();
      visibility = "visible";
      fireEvent(event === "visibilitychange" ? document : window, new Event(event));
      await assertComplete(stats);
      foregroundBurst();
      expect(stats.requests).toHaveLength(3); // idle/terminal must not restart
    },
  );

  it("hidden bursts do nothing; visible bursts create only one in-flight resumed GET", async () => {
    const pending = deferred<Response>();
    const stats = installRun({ resumedPoll: () => pending.promise });
    renderApp(["/chat/63"]);
    await send();
    setVisibility("hidden");
    await paused();
    foregroundBurst();
    expect(stats.requests).toHaveLength(2);
    visibility = "visible";
    foregroundBurst();
    await waitFor(() => expect(stats.requests).toHaveLength(3));
    foregroundBurst();
    expect(stats.requests).toHaveLength(3);
    expect(stats.active).toBe(1);
    await act(async () => pending.resolve(doneResponse()));
    await assertComplete(stats);
  });

  it("foreground before suspended GET rejection consumes that event once, then completes", async () => {
    const pending = deferred<Response>();
    const stats = installRun({ failedPoll: () => pending.promise });
    renderApp(["/chat/63"]);
    await send();
    setVisibility("hidden");
    await waitFor(() => expect(stats.requests).toHaveLength(2));
    setVisibility("visible"); // still live: cannot create parallel GET
    expect(stats.requests).toHaveLength(2);
    await act(async () => pending.reject(new TypeError("Failed to fetch")));
    await assertComplete(stats);
  });

  it("a second failure without another event stays blocked; manual Continue remains functional", async () => {
    let retries = 0;
    const stats = installRun({ resumedPoll: () => {
      retries += 1;
      if (retries === 1) throw new TypeError("Still offline");
      return doneResponse();
    } });
    renderApp(["/chat/63"]);
    await send();
    setVisibility("hidden");
    await paused();
    setVisibility("visible");
    await waitFor(() => expect(stats.requests).toHaveLength(3));
    await paused();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 650)); });
    expect(stats.requests).toHaveLength(3);
    expect(stats.posts).toBe(1);
    expect(storage.readRuntimeLease(63).state).toBe("valid");
    fireEvent.click(screen.getByRole("button", { name: "继续轮询" }));
    await waitFor(() => expect(storage.readRuntimeLease(63).state).toBe("absent"));
    expect(screen.getAllByText("第一段第二段")).toHaveLength(1);
    expect(stats.requests.map((r) => r.cursor)).toEqual([0, 1, 1, 1]);
    expect(stats.maxActive).toBe(1);
  });

  it("route change aborts resumed GET; late completion and later events cannot affect the new chat", async () => {
    const pending = deferred<Response>();
    const stats = installRun({ resumedPoll: () => pending.promise });
    const { unmount } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/chat/63"]}>
          <Routes><Route path="/chat/:conversationId" element={<><Link to="/chat/64">go64</Link><ConversationPage /></>} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await send();
    setVisibility("hidden");
    await paused();
    setVisibility("visible");
    await waitFor(() => expect(stats.requests).toHaveLength(3));
    fireEvent.click(screen.getByRole("link", { name: "go64" }));
    await screen.findByText("64 的历史");
    expect(stats.signals[2].aborted).toBe(true);
    await act(async () => pending.resolve(doneResponse()));
    foregroundBurst();
    expect(screen.queryByText("第一段第二段")).toBeNull();
    expect(storage.readRuntimeLease(64).state).toBe("absent");
    const oldLease = storage.readRuntimeLease(63);
    expect(oldLease.state === "valid" && oldLease.lease.cursor).toBe(1);
    expect(stats.canonicalReads).toBe(0);
    expect(stats.requests).toHaveLength(3);
    unmount();
    foregroundBurst();
    expect(stats.requests).toHaveLength(3);
  });

  it("unmount removes foreground listeners while an eligible paused lease remains durable", async () => {
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const stats = installRun();
    const { unmount } = renderApp(["/chat/63"]);
    await send();
    setVisibility("hidden");
    await paused();
    unmount();
    visibility = "visible";
    foregroundBurst();
    expect(stats.requests).toHaveLength(2);
    expect(storage.readRuntimeLease(63).state).toBe("valid");
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    for (const event of ["focus", "pageshow", "online"]) {
      expect(removeWindow).toHaveBeenCalledWith(event, expect.any(Function));
    }
  });

  it("foreground does not bypass uncertain async acceptance", async () => {
    const stats = installRun({ ack: { status: "processing" } });
    renderApp(["/chat/63"]);
    await selectRuntimeTransport("async");
    const input = await screen.findByRole("textbox", { name: /消息输入框/ });
    fireEvent.change(input, { target: { value: "恢复测试" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    await screen.findByText(/未返回有效的恢复凭据/);
    foregroundBurst();
    expect(stats.requests).toHaveLength(0);
    expect(stats.posts).toBe(1);
    expect(screen.getByRole("button", { name: /发送消息/ })).toBeDisabled();
  });

  it("foreground does not bypass a cursor-persist storage failure", async () => {
    const original = storage.persistRuntimeLease;
    vi.spyOn(storage, "persistRuntimeLease").mockImplementation((prior, next) =>
      next.cursor === 1 ? { state: "mutation_unavailable", reason: "test-storage", verifiedExpectedPrior: prior }
        : original(prior, next),
    );
    const stats = installRun();
    renderApp(["/chat/63"]);
    await selectRuntimeTransport("async");
    const input = await screen.findByRole("textbox", { name: /消息输入框/ });
    fireEvent.change(input, { target: { value: "恢复测试" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    await screen.findByText(/无法保存轮询进度/);
    foregroundBurst();
    expect(stats.requests).toHaveLength(1);
    expect(stats.posts).toBe(1);
    expect(screen.getByRole("button", { name: /重试存储操作/ })).toBeTruthy();
  });

  it("accepted stop survives foreground recovery without another stop POST", async () => {
    const pending = deferred<Response>();
    const stats = installRun({ failedPoll: () => pending.promise, resumedPoll: () => doneResponse("stopped") });
    renderApp(["/chat/63"]);
    await send();
    fireEvent.click(screen.getByRole("button", { name: /停止生成/ }));
    await waitFor(() => expect(stats.stops).toBe(1));
    await waitFor(() => expect(screen.getByRole("button", { name: /停止生成/ })).toBeDisabled());
    setVisibility("hidden");
    await waitFor(() => expect(stats.requests).toHaveLength(2));
    await act(async () => pending.reject(new TypeError("Failed to fetch")));
    await paused();
    setVisibility("visible");
    await assertComplete(stats);
    expect(stats.stops).toBe(1);
  });
});
