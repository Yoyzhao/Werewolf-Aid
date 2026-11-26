import { del, get, set } from 'idb-keyval';

import { hasIndexedDb } from './storage';

export const AI_CONFIG_STORAGE_KEY = 'lrs.ai.config.v1';
export const AI_KEY_SESSION_KEY = 'lrs.ai.key.v1';

export interface AiConfig {
  readonly schemaVersion: 1;
  readonly baseUrl: string;
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly rememberKey: boolean;
}

export const DEFAULT_AI_CONFIG: AiConfig = {
  schemaVersion: 1,
  baseUrl: '',
  model: '',
  temperature: 0.7,
  maxTokens: 800,
  rememberKey: false,
};

export type AiConfigField = 'baseUrl' | 'model' | 'key' | 'temperature' | 'maxTokens';

export type AiConfigErrors = Partial<Record<AiConfigField, string>>;

export interface AiConfigCheckResult {
  readonly ok: boolean;
  readonly errors: AiConfigErrors;
}

let memoryConfig: AiConfig | null = null;
let memoryKey: string | null = null;

function isStoredConfig(value: unknown): value is AiConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<AiConfig>;
  return (
    config.schemaVersion === 1 &&
    typeof config.baseUrl === 'string' &&
    typeof config.model === 'string' &&
    typeof config.temperature === 'number' &&
    typeof config.maxTokens === 'number' &&
    typeof config.rememberKey === 'boolean'
  );
}

function readSessionKey(): string | null {
  try {
    return window.sessionStorage.getItem(AI_KEY_SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionKey(key: string | null): void {
  try {
    if (key) window.sessionStorage.setItem(AI_KEY_SESSION_KEY, key);
    else window.sessionStorage.removeItem(AI_KEY_SESSION_KEY);
  } catch {
    // 隐私模式等场景下 sessionStorage 不可用，Key 仅保留在内存
  }
}

export function checkAiConfig(
  config: AiConfig,
  key: string,
  hasSavedKey: boolean,
): AiConfigCheckResult {
  const errors: AiConfigErrors = {};

  const baseUrl = config.baseUrl.trim();
  if (!baseUrl) {
    errors.baseUrl = '请填写接口地址';
  } else {
    try {
      const url = new URL(baseUrl);
      if (url.protocol !== 'https:') errors.baseUrl = '仅支持 HTTPS 接口地址';
      else if (url.username || url.password) errors.baseUrl = '接口地址不能包含账号密码';
    } catch {
      errors.baseUrl = '接口地址格式不正确';
    }
  }

  if (!config.model.trim()) errors.model = '请填写模型名';

  if (!key.trim() && !hasSavedKey) errors.key = '请填写 API Key';

  if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) {
    errors.temperature = '温度需在 0–2 之间';
  }
  if (!Number.isInteger(config.maxTokens) || config.maxTokens < 100 || config.maxTokens > 2000) {
    errors.maxTokens = '最大输出需为 100–2000 的整数';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

export function isAiConfigured(config: AiConfig, hasKey: boolean): boolean {
  return Boolean(config.baseUrl.trim() && config.model.trim() && hasKey);
}

export interface LoadedAiConfig {
  readonly config: AiConfig;
  readonly hasKey: boolean;
}

export async function loadAiConfig(): Promise<LoadedAiConfig> {
  if (!memoryConfig) {
    let stored: AiConfig | null = null;
    if (hasIndexedDb()) {
      try {
        const raw = await get(AI_CONFIG_STORAGE_KEY);
        if (isStoredConfig(raw)) stored = raw;
      } catch {
        stored = null;
      }
    }
    memoryConfig = stored ?? DEFAULT_AI_CONFIG;
  }

  if (!memoryConfig.rememberKey) writeSessionKey(null);
  const sessionKey = memoryConfig.rememberKey ? readSessionKey() : null;
  memoryKey = memoryKey ?? sessionKey;

  return { config: memoryConfig, hasKey: Boolean(memoryKey) };
}

export function getAiKey(): string | null {
  return memoryKey ?? readSessionKey();
}

export interface SaveAiConfigResult extends LoadedAiConfig {
  readonly ok: boolean;
  readonly errors: AiConfigErrors;
}

export async function saveAiConfig(
  config: AiConfig,
  keyInput: string,
): Promise<SaveAiConfigResult> {
  const hasSavedKey = Boolean(getAiKey());
  const checked = checkAiConfig(config, keyInput, hasSavedKey);
  if (!checked.ok) {
    return {
      ok: false,
      errors: checked.errors,
      config: memoryConfig ?? DEFAULT_AI_CONFIG,
      hasKey: hasSavedKey,
    };
  }

  const key = keyInput.trim() || getAiKey() || '';
  if (config.rememberKey) {
    writeSessionKey(key);
  } else {
    writeSessionKey(null);
  }
  memoryKey = key;

  const next: AiConfig = {
    ...config,
    baseUrl: config.baseUrl.trim(),
    model: config.model.trim(),
  };
  memoryConfig = next;

  if (hasIndexedDb()) {
    try {
      await set(AI_CONFIG_STORAGE_KEY, next);
    } catch {
      // 配置保存失败不影响本次会话使用
    }
  }

  return { ok: true, errors: {}, config: next, hasKey: true };
}

export async function clearAiConfig(): Promise<void> {
  memoryConfig = null;
  memoryKey = null;
  writeSessionKey(null);
  if (hasIndexedDb()) {
    try {
      await del(AI_CONFIG_STORAGE_KEY);
    } catch {
      // 已清理内存配置
    }
  }
}
