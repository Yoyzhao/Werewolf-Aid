import { create } from 'zustand';

import {
  DEFAULT_AI_CONFIG,
  clearAiConfig,
  getAiKey,
  isAiConfigured,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
  type AiConfigErrors,
} from '../lib/ai-config';
import {
  AI_ERROR_MESSAGES,
  AiClientError,
  requestAiAnalysis,
  resetAiSession,
  type AiFailureCode,
} from '../lib/ai-client';

export type AiStatus = 'config-missing' | 'idle' | 'loading' | 'success' | 'error' | 'cancelled';

export interface AiStoreState {
  readonly configLoaded: boolean;
  readonly status: AiStatus;
  readonly config: AiConfig;
  readonly hasKey: boolean;
  readonly result: string;
  readonly errorCode: AiFailureCode | null;
  readonly errorMessage: string;
}

export interface SaveConfigOutcome {
  readonly ok: boolean;
  readonly errors: AiConfigErrors;
}

export interface AiStoreActions {
  init: () => Promise<void>;
  saveConfig: (config: AiConfig, key: string) => Promise<SaveConfigOutcome>;
  clearConfig: () => Promise<void>;
  analyze: (contextText: string) => Promise<void>;
  cancel: () => void;
}

export type AiStore = AiStoreState & AiStoreActions;

let activeController: AbortController | null = null;

const initialAiState: AiStoreState = {
  configLoaded: false,
  status: 'idle',
  config: DEFAULT_AI_CONFIG,
  hasKey: false,
  result: '',
  errorCode: null,
  errorMessage: '',
};

function abortActive(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
}

export const useAiStore = create<AiStore>((set, get) => ({
  ...initialAiState,

  init: async () => {
    if (get().configLoaded) return;
    const loaded = await loadAiConfig();
    set({
      configLoaded: true,
      config: loaded.config,
      hasKey: loaded.hasKey,
      status: isAiConfigured(loaded.config, loaded.hasKey) ? 'idle' : 'config-missing',
    });
  },

  saveConfig: async (config, key) => {
    abortActive();
    const saved = await saveAiConfig(config, key);
    if (!saved.ok) return { ok: false, errors: saved.errors };

    set({
      config: saved.config,
      hasKey: saved.hasKey,
      status: 'idle',
      result: '',
      errorCode: null,
      errorMessage: '',
    });
    return { ok: true, errors: {} };
  },

  clearConfig: async () => {
    abortActive();
    resetAiSession();
    await clearAiConfig();
    set({
      config: DEFAULT_AI_CONFIG,
      hasKey: false,
      status: 'config-missing',
      result: '',
      errorCode: null,
      errorMessage: '',
    });
  },

  analyze: async (contextText) => {
    if (get().status === 'loading') return;

    const current = get();
    if (!current.configLoaded) await get().init();
    const state = get();
    if (!isAiConfigured(state.config, state.hasKey)) {
      set({ status: 'config-missing' });
      return;
    }

    const apiKey = getAiKey();
    if (!apiKey) {
      set({ status: 'config-missing', hasKey: false });
      return;
    }

    abortActive();
    const controller = new AbortController();
    activeController = controller;
    set({ status: 'loading', result: '', errorCode: null, errorMessage: '' });

    try {
      const result = await requestAiAnalysis({
        config: state.config,
        apiKey,
        contextText,
        signal: controller.signal,
      });
      if (activeController !== controller) return;
      set({ status: 'success', result: result.content });
    } catch (error) {
      if (activeController !== controller) return;
      const code: AiFailureCode = error instanceof AiClientError ? error.code : 'NETWORK';
      if (code === 'CANCELLED') {
        set({ status: 'cancelled', errorCode: null, errorMessage: AI_ERROR_MESSAGES.CANCELLED });
      } else {
        set({
          status: 'error',
          errorCode: code,
          errorMessage: error instanceof AiClientError ? error.message : AI_ERROR_MESSAGES.NETWORK,
        });
      }
    } finally {
      if (activeController === controller) activeController = null;
    }
  },

  cancel: () => {
    if (!activeController) return;
    activeController.abort();
    activeController = null;
    set({ status: 'cancelled', errorCode: null, errorMessage: AI_ERROR_MESSAGES.CANCELLED });
  },
}));
