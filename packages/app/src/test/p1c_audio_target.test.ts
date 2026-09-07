import { describe, expect, it } from 'vitest';
import {
  audioTargetUnsupportedText,
  resolveAudioTarget,
} from '../features/chat/audio/audioTarget';
import type { ModelCatalog } from 'exo-shared/models';

const catalog: ModelCatalog = {
  models: [
    { name: 'gemini-2.5-flash', family: 'gemini', abilities: ['audio', 'vision'], compatible_endpoint_ids: [2] },
    { name: 'deepseek-v4-flash', family: 'deepseek', abilities: [], compatible_endpoint_ids: [1] },
  ],
  endpoints: [
    { id: 1, name: 'deepseek-api', provider: 'deepseek', execution_type: 'cloud', execution_adapter: 'http', payload_format: 'chat', cache_transport: '', attachment_transports: [], configured: true, enabled: true },
    { id: 2, name: 'gemini-antigravity', provider: 'gemini', execution_type: 'cloud', execution_adapter: 'http', payload_format: 'chat', cache_transport: 'context_cache', attachment_transports: ['file_uri'], configured: true, enabled: true },
  ],
  roles: {
    main: [
      { model: 'gemini-2.5-flash', default_endpoint: 2 },
      { model: 'deepseek-v4-flash', default_endpoint: 1 },
    ],
    support: {},
  },
  providers: [],
};

const presetOf = (default_model: string | null) => ({ default_model });

describe('P1C audio target gate (Task 3.2, Gate E)', () => {
  it('resolves a supported target for an audio-capable model + file_uri endpoint', () => {
    const { gate, target } = resolveAudioTarget(catalog, presetOf('gemini-2.5-flash'));
    expect(gate.state).toBe('supported');
    if (gate.state === 'supported') {
      expect(gate.target).toEqual({ model: 'gemini-2.5-flash', endpoint: 2 });
    }
    expect(target).toEqual({ model: 'gemini-2.5-flash', endpoint: 2 });
  });

  it('blocks models without the audio ability', () => {
    const { gate, reason } = resolveAudioTarget(catalog, presetOf('deepseek-v4-flash'));
    expect(gate.state).toBe('unsupported');
    expect(reason).toBe('model_without_audio');
  });

  it('blocks endpoints lacking the file_uri attachment transport', () => {
    const catalogWithoutTransport: ModelCatalog = {
      ...catalog,
      endpoints: [
        { ...catalog.endpoints[0], id: 2, attachment_transports: [] },
      ],
      models: [
        { ...catalog.models[0], compatible_endpoint_ids: [2] },
      ],
      roles: { main: [{ model: 'gemini-2.5-flash', default_endpoint: 2 }], support: {} },
    };
    const { gate, reason } = resolveAudioTarget(catalogWithoutTransport, presetOf('gemini-2.5-flash'));
    expect(gate.state).toBe('unsupported');
    expect(reason).toBe('endpoint_without_file_uri');
  });

  it('reports catalog unavailability explicitly (retryable)', () => {
    const { gate, reason } = resolveAudioTarget(null, presetOf('gemini-2.5-flash'));
    expect(gate.state).toBe('unsupported');
    expect(reason).toBe('catalog_unavailable');
    expect(audioTargetUnsupportedText(reason!)).toContain('模型目录暂不可用');
  });

  it('reports missing preset/default_model', () => {
    const { gate, reason } = resolveAudioTarget(catalog, presetOf(null));
    expect(gate.state).toBe('unsupported');
    expect(reason).toBe('preset_unavailable');
  });

  it('reports unresolved target when endpoint is null', () => {
    // Unknown model outside roles.main and catalog models → no compatible
    // endpoints → endpoint stays null (explicit unresolved).
    const { gate, reason } = resolveAudioTarget(catalog, presetOf('unknown-model'));
    expect(gate.state).toBe('unsupported');
    expect(reason).toBe('target_unresolved');
  });
});