import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("exo-shared", () => ({
  configApi: {
    createEndpoint: vi.fn(),
    updateEndpoint: vi.fn(),
  },
}));

import { configApi } from "exo-shared";
import EndpointEditModal from "./EndpointEditModal.jsx";

const DIRECT_PROFILE = {
  id: "deepseek",
  display_name: "DeepSeek Official",
  execution_type: "direct_api",
  execution_adapter: "internal_http",
  requires_endpoint_api_key: true,
  base_url: "https://api.deepseek.com/v1",
  payload_format: "openai",
  cache_transport: "inline_chunk",
  attachment_transports: ["file_id", "inline_text"],
  supported_families: ["deepseek"],
  supported_models: [],
  model_name_overrides: {},
};

const MANAGED_PROFILE = {
  id: "antigravity",
  display_name: "Antigravity Subscription",
  execution_type: "managed_runtime",
  execution_adapter: "subscription_runtime",
  requires_endpoint_api_key: false,
  base_url: "",
  payload_format: "runtime",
  cache_transport: "runtime_managed",
  attachment_transports: [],
  supported_families: [],
  supported_models: ["gemini-3.1-pro-preview"],
  model_name_overrides: {
    "gemini-3.1-pro-preview": "gemini-3.1-pro-high",
  },
};

const API_KEYS = [
  { alias: "deepseek-main", platform: "deepseek" },
  { alias: "other-key", platform: "gemini" },
];

function renderModal(overrides = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    endpoint: null,
    apiKeys: API_KEYS,
    providers: [DIRECT_PROFILE, MANAGED_PROFILE],
    onSaved: vi.fn(),
    ...overrides,
  };
  return {
    ...render(<EndpointEditModal {...props} />),
    props,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  configApi.createEndpoint.mockResolvedValue({ id: 1 });
  configApi.updateEndpoint.mockResolvedValue({ id: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EndpointEditModal provider projection", () => {
  it("renders provider options only from the backend projection", async () => {
    renderModal({ providers: [MANAGED_PROFILE] });

    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("antigravity");
    });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Antigravity Subscription" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Gemini" })).toBeNull();
  });

  it("shows the direct key requirement and submits the selected alias", async () => {
    const { props } = renderModal({ providers: [DIRECT_PROFILE] });
    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("deepseek");
    });

    expect(screen.getByText("需要 API key")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "deepseek-main (deepseek)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "other-key (gemini)" })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("e.g. Gemini Official"), {
      target: { value: "  Direct Endpoint  " },
    });
    fireEvent.change(screen.getByLabelText("Credentials / 关联密钥"), {
      target: { value: "deepseek-main" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SAVE ENDPOINT/ }));

    await waitFor(() => {
      expect(configApi.createEndpoint).toHaveBeenCalledWith({
        name: "Direct Endpoint",
        provider: "deepseek",
        api_key_alias: "deepseek-main",
        enabled: true,
      });
    });
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("hides the key selector and submits null for a managed profile", async () => {
    const { props } = renderModal({ providers: [MANAGED_PROFILE] });
    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("antigravity");
    });

    expect(screen.queryByLabelText("Credentials / 关联密钥")).toBeNull();
    expect(screen.getAllByText("不使用 Endpoint API key（外部 Runtime 凭证）").length).toBeGreaterThan(0);
    expect(screen.getByText("gemini-3.1-pro-preview → gemini-3.1-pro-high")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g. Gemini Official"), {
      target: { value: "Managed Endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SAVE ENDPOINT/ }));

    await waitFor(() => {
      expect(configApi.createEndpoint).toHaveBeenCalledWith({
        name: "Managed Endpoint",
        provider: "antigravity",
        api_key_alias: null,
        enabled: true,
      });
    });
    expect(props.onSaved).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("disables save when provider templates are unavailable", () => {
    renderModal({ providers: [] });

    expect(screen.getAllByText("Provider 模板不可用").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /SAVE ENDPOINT/ })).toBeDisabled();
    expect(configApi.createEndpoint).not.toHaveBeenCalled();
  });

  it("selects the first provider when projection data arrives late for a new endpoint", async () => {
    const { rerender, props } = renderModal({ providers: [] });
    expect(screen.getByLabelText("Provider / 渠道").options).toHaveLength(0);

    rerender(
      <EndpointEditModal
        {...props}
        providers={[DIRECT_PROFILE, MANAGED_PROFILE]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("deepseek");
    });
  });

  it("does not reset an existing endpoint provider when projection data arrives", async () => {
    const endpoint = {
      id: 9,
      name: "Existing Direct",
      provider: "deepseek",
      api_key_alias: "deepseek-main",
      enabled: true,
    };
    const { rerender, props } = renderModal({ endpoint, providers: [] });

    rerender(
      <EndpointEditModal
        {...props}
        endpoint={endpoint}
        providers={[MANAGED_PROFILE, DIRECT_PROFILE]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("deepseek");
    });
  });

  it.each([
    [{ status: 404, message: "Not found" }],
    [{ message: "Failed to fetch" }],
  ])("keeps the modal open and reports save failure for %o", async error => {
    configApi.createEndpoint.mockRejectedValueOnce(error);
    const { props } = renderModal({ providers: [MANAGED_PROFILE] });
    await waitFor(() => {
      expect(screen.getByLabelText("Provider / 渠道")).toHaveValue("antigravity");
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Gemini Official"), {
      target: { value: "Failed Endpoint" },
    });
    fireEvent.click(screen.getByRole("button", { name: /SAVE ENDPOINT/ }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(`保存失败: ${error.message}`);
    });
    expect(props.onSaved).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
