import { describe, expect, it } from 'vitest';
import {
  audioTargetUnsupportedText,
  resolveAudioTarget,
  resolveSelectedAudioTarget,
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

  describe('Managed Runtime audio target gate (Plan R1)', () => {
    const managedCatalog: ModelCatalog = {
      models: [
        { name: 'gemini-3.8-flash', family: 'gemini', abilities: ['audio', 'vision'], compatible_endpoint_ids: [7] },
        { name: 'deepseek-chat', family: 'deepseek', abilities: [], compatible_endpoint_ids: [7] },
      ],
      endpoints: [
        {
          id: 7,
          name: 'agy-runtime',
          provider: 'google',
          execution_type: 'managed_runtime',
          execution_adapter: 'managed_runtime',
          payload_format: 'chat',
          cache_transport: '',
          attachment_transports: [],
          configured: true,
          enabled: true,
        },
      ],
      roles: {
        main: [
          { model: 'gemini-3.8-flash', default_endpoint: 7 },
          { model: 'deepseek-chat', default_endpoint: 7 },
        ],
        support: {},
      },
      providers: [],
    };

    it('resolves a supported target for managed_runtime endpoints with audio-capable model without file_uri transport', () => {
      const { gate, target } = resolveAudioTarget(managedCatalog, presetOf('gemini-3.8-flash'));
      expect(gate.state).toBe('supported');
      expect(target).toEqual({ model: 'gemini-3.8-flash', endpoint: 7 });

      const selectedGate = resolveSelectedAudioTarget(managedCatalog, { model: 'gemini-3.8-flash', endpoint: 7 });
      expect(selectedGate.state).toBe('supported');
      if (selectedGate.state === 'supported') {
        expect(selectedGate.target).toEqual({ model: 'gemini-3.8-flash', endpoint: 7 });
      }
    });

    it('blocks managed_runtime endpoints if model lacks audio ability', () => {
      const { gate, reason } = resolveAudioTarget(managedCatalog, presetOf('deepseek-chat'));
      expect(gate.state).toBe('unsupported');
      expect(reason).toBe('model_without_audio');

      const selectedGate = resolveSelectedAudioTarget(managedCatalog, { model: 'deepseek-chat', endpoint: 7 });
      expect(selectedGate.state).toBe('unsupported');
      if (selectedGate.state === 'unsupported') {
        expect(selectedGate.reason).toBe('model_without_audio');
      }
    });

    it('retains file_uri requirement for cloud / direct_api endpoints', () => {
      const cloudCatalog: ModelCatalog = {
        ...managedCatalog,
        endpoints: [
          {
            ...managedCatalog.endpoints[0],
            execution_type: 'cloud',
          },
        ],
      };
      const { gate, reason } = resolveAudioTarget(cloudCatalog, presetOf('gemini-3.8-flash'));
      expect(gate.state).toBe('unsupported');
      expect(reason).toBe('endpoint_without_file_uri');

      const selectedGate = resolveSelectedAudioTarget(cloudCatalog, { model: 'gemini-3.8-flash', endpoint: 7 });
      expect(selectedGate.state).toBe('unsupported');
      if (selectedGate.state === 'unsupported') {
        expect(selectedGate.reason).toBe('endpoint_without_file_uri');
      }
    });
  });
});