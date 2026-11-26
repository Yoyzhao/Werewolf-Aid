import type { AiRelayRequest, AiRelayResponse, ApiErrorCode, SessionResponse } from '@lrs/shared';

import type { AiConfig } from './ai-config';

export const AI_SESSION_PATH = '/api/v1/session';
export const AI_RELAY_PATH = '/api/v1/ai/relay';
export const AI_TIMEOUT_MS = 60_000;

export const AI_SYSTEM_PROMPT = [
  '你是狼人杀复盘助手，只根据用户提供的记录做整理，不编造未出现的信息。',
  '请用简体中文输出，并按以下结构分段：',
  '1. 信息整理：归纳身份、局势、公开事件与玩家记录。',
  '2. 可疑对象：列出值得关注的座位与理由。',
  '3. 下一步建议：给出可执行的发言、查验或投票建议。',
  '最后用“依据”列出你主要引用的记录；信息不足时明确说明不确定。',
].join('\n');

const API_ERROR_CODES = new Set<ApiErrorCode>([
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'STALE_VERSION',
  'INVALID_STATE',
  'RATE_LIMITED',
  'TIMEOUT',
  'UPSTREAM_4XX',
  'UPSTREAM_5XX',
  'KEY_INVALID',
  'QUOTA',
  'URL_NOT_ALLOWED',
  'NETWORK',
  'INTERNAL',
]);

export type AiFailureCode = ApiErrorCode | 'CANCELLED';

export const AI_ERROR_MESSAGES: Record<AiFailureCode, string> = {
  INVALID_REQUEST: '请求参数有误，请检查模型配置',
  UNAUTHORIZED: '会话已失效，请刷新页面后重试',
  FORBIDDEN: '请求被拒绝，请刷新页面后重试',
  NOT_FOUND: '接口不存在，请检查接口地址',
  CONFLICT: '请求冲突，请稍后重试',
  STALE_VERSION: '数据版本过期，请刷新页面后重试',
  INVALID_STATE: '当前状态不允许该操作',
  RATE_LIMITED: '请求过于频繁，请稍后再试',
  TIMEOUT: '请求超时（60 秒），请稍后重试',
  UPSTREAM_4XX: '模型服务拒绝了请求，请检查模型配置',
  UPSTREAM_5XX: '模型服务暂时不可用，请稍后重试',
  KEY_INVALID: 'Key 无效，请检查后重试',
  QUOTA: '额度不足，请检查账户余额',
  URL_NOT_ALLOWED: '该地址不被允许，请使用 HTTPS 公网地址',
  NETWORK: '网络不可用，请检查网络后重试',
  INTERNAL: '服务器内部错误，请稍后重试',
  CANCELLED: '已取消，未产生结果',
};

const NON_RETRYABLE = new Set<AiFailureCode>([
  'URL_NOT_ALLOWED',
  'INVALID_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CANCELLED',
]);

export function isRetryableAiError(code: AiFailureCode): boolean {
  return !NON_RETRYABLE.has(code);
}

export class AiClientError extends Error {
  readonly code: AiFailureCode;

  constructor(code: AiFailureCode) {
    super(AI_ERROR_MESSAGES[code]);
    this.name = 'AiClientError';
    this.code = code;
  }
}

export interface AiAnalysisResult {
  readonly content: string;
  readonly usage?: { readonly promptTokens: number; readonly completionTokens: number };
}

export interface AiAnalysisOptions {
  readonly config: AiConfig;
  readonly apiKey: string;
  readonly contextText: string;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

let csrfToken: string | null = null;
let sessionPromise: Promise<string> | null = null;

async function readSession(fetchImpl: typeof fetch): Promise<string> {
  const response = await fetchImpl(AI_SESSION_PATH, {
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new AiClientError('NETWORK');
  const data = (await response.json()) as Partial<SessionResponse>;
  if (typeof data.csrfToken !== 'string' || !data.csrfToken) {
    throw new AiClientError('NETWORK');
  }
  return data.csrfToken;
}

export async function ensureAiSession(fetchImpl: typeof fetch = fetch): Promise<string> {
  if (csrfToken) return csrfToken;
  if (!sessionPromise) {
    sessionPromise = readSession(fetchImpl)
      .then((token) => {
        csrfToken = token;
        return token;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

export async function refreshAiSession(fetchImpl: typeof fetch = fetch): Promise<string> {
  csrfToken = null;
  sessionPromise = null;
  return ensureAiSession(fetchImpl);
}

export function resetAiSession(): void {
  csrfToken = null;
  sessionPromise = null;
}

export async function primeAiSession(fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await ensureAiSession(fetchImpl);
  } catch {
    csrfToken = null;
    sessionPromise = null;
  }
}

function buildBody(options: AiAnalysisOptions): AiRelayRequest {
  return {
    baseUrl: options.config.baseUrl.trim(),
    apiKey: options.apiKey,
    model: options.config.model.trim(),
    messages: [
      { role: 'system', content: AI_SYSTEM_PROMPT },
      { role: 'user', content: options.contextText },
    ],
    temperature: options.config.temperature,
    maxTokens: options.config.maxTokens,
  };
}

async function errorFromResponse(response: Response): Promise<AiClientError> {
  let code: unknown;
  try {
    const data = (await response.json()) as { error?: { code?: unknown } };
    code = data.error?.code;
  } catch {
    code = undefined;
  }
  if (typeof code === 'string' && API_ERROR_CODES.has(code as ApiErrorCode)) {
    return new AiClientError(code as ApiErrorCode);
  }
  if (response.status === 429) return new AiClientError('RATE_LIMITED');
  if (response.status >= 500) return new AiClientError('UPSTREAM_5XX');
  return new AiClientError('NETWORK');
}

function toResult(data: Partial<AiRelayResponse>): AiAnalysisResult {
  if (data.ok !== true || typeof data.content !== 'string' || !data.content.trim()) {
    throw new AiClientError('UPSTREAM_5XX');
  }
  const usage = data.usage;
  if (
    usage &&
    typeof usage.promptTokens === 'number' &&
    typeof usage.completionTokens === 'number'
  ) {
    return {
      content: data.content,
      usage: { promptTokens: usage.promptTokens, completionTokens: usage.completionTokens },
    };
  }
  return { content: data.content };
}

async function sendWithSessionRetry(
  fetchImpl: typeof fetch,
  options: AiAnalysisOptions,
  signal: AbortSignal,
): Promise<AiAnalysisResult> {
  const body = buildBody(options);
  let token = await ensureAiSession(fetchImpl);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchImpl(AI_RELAY_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-csrf-token': token,
      },
      body: JSON.stringify(body),
      signal,
    });

    if ((response.status === 401 || response.status === 403) && attempt === 0) {
      token = await refreshAiSession(fetchImpl);
      continue;
    }

    if (!response.ok) throw await errorFromResponse(response);
    const data = (await response.json()) as Partial<AiRelayResponse>;
    return toResult(data);
  }

  throw new AiClientError('FORBIDDEN');
}

export async function requestAiAnalysis(options: AiAnalysisOptions): Promise<AiAnalysisResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;
  const controller = new AbortController();
  const external = options.signal;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const abortFromExternal = (): void => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener('abort', abortFromExternal, { once: true });

  try {
    return await sendWithSessionRetry(fetchImpl, options, controller.signal);
  } catch (error) {
    if (timedOut) throw new AiClientError('TIMEOUT');
    if (external?.aborted) throw new AiClientError('CANCELLED');
    if (error instanceof AiClientError) throw error;
    throw new AiClientError('NETWORK');
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', abortFromExternal);
  }
}
