import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { installFetch, jsonResponse, renderApp, unmockFetch, type MockRoute } from './helpers';

/** #72 U2: the conversation back link returns to the page the user came from. */

const PRESET_ECKI = {
  id: 5,
  name: 'Ecki',
  description: 'fast',
  agent_type: 'standard',
  default_model: 'deepseek-v4-flash',
  system_prompt: 'Be brief.',
  is_visible: true,
};

const PROJECT_ALPHA = {
  id: 7,
  name: 'Alpha',
  description: null,
  prompt: null,
  work_dir: null,
  created_at: '2026-07-01T00:00:00Z',
};

function wireConv(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    name: `conv ${id}`,
    created_at: '2026-09-01T10:00:00Z',
    frozen_project_ids: [],
    project: 0,
    project_name: null,
    agent_type: 'standard',
    agent_preset_id: 5,
    last_message_at: null,
    thinking_level: 'auto',
    memory_injection_enabled: null,
    is_prime: false,
    ...over,
  };
}

const CONV_1 = wireConv(1, { project: 7, project_name: 'Alpha' });

function routes(): MockRoute[] {
  return [
    { test: '/api/agents/presets/', handler: () => jsonResponse([PRESET_ECKI]) },
    { test: '/api/agents/presets/5/', handler: () => jsonResponse(PRESET_ECKI) },
    { test: '/api/agents/conversations/', handler: () => jsonResponse([CONV_1]) },
    { test: '/api/agents/conversations/1/', handler: () => jsonResponse(CONV_1) },
    { test: '/api/agents/chat/1/', handler: () => jsonResponse({ messages: [], total_count: 0, has_more: false }) },
    { test: '/api/core/projects/7/', handler: () => jsonResponse(PROJECT_ALPHA) },
    { test: '/api/memory/plasmids/', handler: () => jsonResponse([]) },
  ];
}

async function enterConversationFrom(entryPath: string) {
  installFetch(routes());
  renderApp([entryPath]);
  const row = await screen.findByRole('link', { name: /conv 1/ });
  fireEvent.click(row);
  await screen.findByRole('heading', { name: 'conv 1' });
}

afterEach(() => {
  unmockFetch();
});

describe('conversation strict-parent back link (#72 U2)', () => {
  it('returns to Chat Home when entered from Chat Home', async () => {
    await enterConversationFrom('/');
    expect(screen.getByRole('link', { name: 'Chat Home' })).toHaveAttribute('href', '/');
  });

  it('returns to the Agent Profile by name when entered from it', async () => {
    await enterConversationFrom('/agents/5');
    const back = document.querySelector('.app-back-link');
    expect(back).toHaveAttribute('href', '/agents/5');
    expect(back).toHaveTextContent('Ecki');
  });

  it('returns to the Project Detail by name when entered from it', async () => {
    await enterConversationFrom('/projects/7');
    const back = document.querySelector('.app-back-link');
    expect(back).toHaveAttribute('href', '/projects/7');
    expect(back).toHaveTextContent('Alpha');
  });

  it('falls back to Chat Home on a direct link', async () => {
    installFetch(routes());
    renderApp(['/chat/1']);
    await screen.findByRole('heading', { name: 'conv 1' });
    const back = document.querySelector('.app-back-link');
    expect(back).toHaveAttribute('href', '/');
    expect(back).toHaveTextContent('Chat Home');
  });
});
