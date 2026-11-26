import { Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { checkAiConfig, type AiConfig, type AiConfigErrors } from '../../lib/ai-config';
import type { SaveConfigOutcome } from '../../stores/ai-store';

export interface AIConfigFormProps {
  readonly config: AiConfig;
  readonly hasKey: boolean;
  readonly onSave: (config: AiConfig, key: string) => Promise<SaveConfigOutcome>;
  readonly onClear: () => Promise<void>;
}

const INPUT_BASE_CLASS =
  'min-h-11 w-full rounded-xl border border-line-strong bg-surface-2 px-3 text-sm text-parchment placeholder:text-faint focus:border-gold focus:outline-none';
const INPUT_CLASS = `mt-1 ${INPUT_BASE_CLASS}`;

export function AIConfigForm({ config, hasKey, onSave, onClear }: AIConfigFormProps) {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [model, setModel] = useState(config.model);
  const [key, setKey] = useState('');
  const [rememberKey, setRememberKey] = useState(config.rememberKey);
  const [temperature, setTemperature] = useState(String(config.temperature));
  const [maxTokens, setMaxTokens] = useState(String(config.maxTokens));
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<AiConfigErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setRememberKey(config.rememberKey);
    setTemperature(String(config.temperature));
    setMaxTokens(String(config.maxTokens));
  }, [config]);

  const buildConfig = (): AiConfig => ({
    schemaVersion: 1,
    baseUrl,
    model,
    temperature: Number(temperature),
    maxTokens: Number(maxTokens),
    rememberKey,
  });

  const handleSave = async (): Promise<void> => {
    const next = buildConfig();
    const checked = checkAiConfig(next, key, hasKey);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const outcome = await onSave(next, key);
      if (!outcome.ok) {
        setErrors(outcome.errors);
        return;
      }
      setErrors({});
      setKey('');
      toast('AI 配置已保存');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (): Promise<void> => {
    await onClear();
    setBaseUrl('');
    setModel('');
    setKey('');
    setRememberKey(false);
    setTemperature('0.7');
    setMaxTokens('800');
    setErrors({});
    toast('AI 配置已清除');
  };

  return (
    <section className="card" aria-labelledby="ai-config-title">
      <div className="card-head">
        <h3 id="ai-config-title">AI 配置</h3>
        <span className="hint">{hasKey && config.baseUrl ? '已配置' : '未配置'}</span>
      </div>

      <div className="space-y-3">
        <label className="block text-[11.5px] text-faint" htmlFor="ai-base-url">
          接口地址
          <input
            id="ai-base-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.example.com/v1/chat/completions"
            aria-invalid={Boolean(errors.baseUrl)}
            className={INPUT_CLASS}
          />
          {errors.baseUrl ? (
            <span className="mt-1 block text-xs text-danger">{errors.baseUrl}</span>
          ) : null}
        </label>

        <label className="block text-[11.5px] text-faint" htmlFor="ai-model">
          模型名
          <input
            id="ai-model"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={model}
            onChange={(event) => setModel(event.target.value)}
            placeholder="gpt-4o-mini"
            aria-invalid={Boolean(errors.model)}
            className={INPUT_CLASS}
          />
          {errors.model ? (
            <span className="mt-1 block text-xs text-danger">{errors.model}</span>
          ) : null}
        </label>

        <div>
          <label className="block text-[11.5px] text-faint" htmlFor="ai-key">
            API Key
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="ai-key"
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={hasKey ? '已保存，留空保持不变' : 'sk-...'}
              aria-invalid={Boolean(errors.key)}
              className={INPUT_BASE_CLASS}
            />
            <button
              type="button"
              className="btn ghost"
              aria-label={showKey ? '隐藏 Key' : '显示 Key'}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.key ? <span className="mt-1 block text-xs text-danger">{errors.key}</span> : null}
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm text-parchment">
          <input
            type="checkbox"
            checked={rememberKey}
            onChange={(event) => setRememberKey(event.target.checked)}
            className="size-5 accent-[var(--accent)]"
          />
          记住本次会话
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[11.5px] text-faint" htmlFor="ai-temperature">
            温度
            <input
              id="ai-temperature"
              type="number"
              inputMode="decimal"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
              aria-invalid={Boolean(errors.temperature)}
              className={INPUT_CLASS}
            />
            {errors.temperature ? (
              <span className="mt-1 block text-xs text-danger">{errors.temperature}</span>
            ) : null}
          </label>
          <label className="block text-[11.5px] text-faint" htmlFor="ai-max-tokens">
            最大输出
            <input
              id="ai-max-tokens"
              type="number"
              inputMode="numeric"
              min={100}
              max={2000}
              step={100}
              value={maxTokens}
              onChange={(event) => setMaxTokens(event.target.value)}
              aria-invalid={Boolean(errors.maxTokens)}
              className={INPUT_CLASS}
            />
            {errors.maxTokens ? (
              <span className="mt-1 block text-xs text-danger">{errors.maxTokens}</span>
            ) : null}
          </label>
        </div>

        <p className="text-[11.5px] leading-5 text-faint">
          Key 默认仅本次会话使用；勾选后写入 sessionStorage，关闭标签页失效，不写入长期存储。
        </p>

        <div className="btn-row">
          <button type="button" className="btn primary" disabled={saving} onClick={handleSave}>
            {saving ? '保存中…' : '保存配置'}
          </button>
          <button type="button" className="btn ghost" onClick={handleClear}>
            清除配置
          </button>
        </div>
      </div>
    </section>
  );
}
