import { AI_ERROR_MESSAGES, isRetryableAiError, type AiFailureCode } from '../../lib/ai-client';
import type { AiStatus } from '../../stores/ai-store';

export interface AIPanelProps {
  readonly status: AiStatus;
  readonly configLoaded: boolean;
  readonly result: string;
  readonly errorCode: AiFailureCode | null;
  readonly errorMessage: string;
  /** 非空时禁止发起 AI 请求（例如自由描述超限）。 */
  readonly blockReason?: string | null;
  readonly onAnalyze: () => void;
  readonly onCancel: () => void;
}

const STATUS_LABEL: Record<AiStatus, string> = {
  'config-missing': '未配置',
  idle: '待命',
  loading: '整理中',
  success: '已完成',
  error: '失败',
  cancelled: '已取消',
};

const PRIVACY_TEXT =
  '上下文将发往你自配的第三方模型；Key 默认仅本次会话使用。请勿填写真实姓名、手机号、身份证号或银行卡号。';
const BOUNDARY_TEXT = 'AI 分析仅供参考，可能出错，请自行判断。';

export function AIPanel({
  status,
  configLoaded,
  result,
  errorCode,
  errorMessage,
  blockReason,
  onAnalyze,
  onCancel,
}: AIPanelProps) {
  const retryable = errorCode ? isRetryableAiError(errorCode) : true;
  const blocked = Boolean(blockReason);

  return (
    <section className="card" aria-labelledby="ai-panel-title">
      <div className="card-head">
        <h3 id="ai-panel-title">AI 军师</h3>
        <span className="hint">{configLoaded ? STATUS_LABEL[status] : '读取配置'}</span>
      </div>

      {!configLoaded ? <p className="text-sm text-muted">正在读取 AI 配置…</p> : null}

      {configLoaded && status === 'config-missing' ? (
        <>
          <p className="text-sm text-muted">
            还没有配置 AI。填写接口地址、模型名和 Key 后即可让军师整理。
          </p>
          <p className="mt-2 text-[11.5px] leading-5 text-faint">{PRIVACY_TEXT}</p>
        </>
      ) : null}

      {configLoaded && status === 'idle' ? (
        <>
          <p className="text-sm text-muted">
            还没有分析结果。先补全身份、局势和玩家记录，再让军师整理。
          </p>
          <button
            type="button"
            className="btn primary mt-3"
            disabled={blocked}
            title={blockReason ?? undefined}
            onClick={onAnalyze}
          >
            让军师整理
          </button>
        </>
      ) : null}

      {configLoaded && status === 'loading' ? (
        <>
          <p className="text-sm text-gold-soft" role="status">
            军师正在整理，最长等待 60 秒…
          </p>
          <button type="button" className="btn ghost mt-3" onClick={onCancel}>
            取消
          </button>
        </>
      ) : null}

      {configLoaded && status === 'success' ? (
        <>
          <div
            role="region"
            aria-label="AI 分析结果"
            className="max-h-96 overflow-auto rounded-xl border border-line bg-surface-2 p-3 text-sm leading-7 whitespace-pre-wrap break-words text-parchment"
          >
            {result}
          </div>
          <button
            type="button"
            className="btn mt-3"
            disabled={blocked}
            title={blockReason ?? undefined}
            onClick={onAnalyze}
          >
            重新整理
          </button>
        </>
      ) : null}

      {configLoaded && status === 'error' ? (
        <>
          <div className="warn-strip strong" role="alert">
            <span>{errorMessage || AI_ERROR_MESSAGES.NETWORK}</span>
          </div>
          {retryable ? (
            <button
              type="button"
              className="btn mt-3"
              disabled={blocked}
              title={blockReason ?? undefined}
              onClick={onAnalyze}
            >
              重试
            </button>
          ) : (
            <p className="mt-2 text-xs text-faint">请修改配置后重试。</p>
          )}
        </>
      ) : null}

      {configLoaded && status === 'cancelled' ? (
        <>
          <p className="text-sm text-muted" role="status">
            {AI_ERROR_MESSAGES.CANCELLED}
          </p>
          <button
            type="button"
            className="btn mt-3"
            disabled={blocked}
            title={blockReason ?? undefined}
            onClick={onAnalyze}
          >
            重新整理
          </button>
        </>
      ) : null}

      {configLoaded ? (
        <p className="mt-3 text-[11.5px] leading-5 text-faint">{BOUNDARY_TEXT}</p>
      ) : null}
    </section>
  );
}
