import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_AI_CONFIG,
  clearAiConfig,
  checkAiConfig,
  getAiKey,
  loadAiConfig,
  saveAiConfig,
  type AiConfig,
} from './ai-config';

const VALID: AiConfig = {
  schemaVersion: 1,
  baseUrl: 'https://api.example.com/v1/chat/completions',
  model: 'gpt-test',
  temperature: 0.7,
  maxTokens: 800,
  rememberKey: false,
};

beforeEach(async () => {
  await clearAiConfig();
  window.sessionStorage.clear();
});

describe('checkAiConfig', () => {
  it('接受合法配置', () => {
    const result = checkAiConfig(VALID, 'sk-test', false);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('拒绝缺少地址、模型与 Key', () => {
    const result = checkAiConfig({ ...VALID, baseUrl: '', model: '' }, '', false);
    expect(result.ok).toBe(false);
    expect(result.errors.baseUrl).toBe('请填写接口地址');
    expect(result.errors.model).toBe('请填写模型名');
    expect(result.errors.key).toBe('请填写 API Key');
  });

  it('仅允许 https 且不能内嵌账号密码', () => {
    expect(
      checkAiConfig({ ...VALID, baseUrl: 'http://api.example.com' }, 'k', false).errors.baseUrl,
    ).toBe('仅支持 HTTPS 接口地址');
    expect(
      checkAiConfig({ ...VALID, baseUrl: 'https://user:pass@api.example.com' }, 'k', false).errors
        .baseUrl,
    ).toBe('接口地址不能包含账号密码');
    expect(checkAiConfig({ ...VALID, baseUrl: 'not-a-url' }, 'k', false).errors.baseUrl).toBe(
      '接口地址格式不正确',
    );
  });

  it('校验温度与最大输出边界', () => {
    expect(
      checkAiConfig({ ...VALID, temperature: -0.1 }, 'k', false).errors.temperature,
    ).toBeDefined();
    expect(
      checkAiConfig({ ...VALID, temperature: 2.1 }, 'k', false).errors.temperature,
    ).toBeDefined();
    expect(checkAiConfig({ ...VALID, maxTokens: 99 }, 'k', false).errors.maxTokens).toBeDefined();
    expect(checkAiConfig({ ...VALID, maxTokens: 2001 }, 'k', false).errors.maxTokens).toBeDefined();
    expect(
      checkAiConfig({ ...VALID, maxTokens: 800.5 }, 'k', false).errors.maxTokens,
    ).toBeDefined();
  });

  it('已有 Key 时允许留空，仅保留旧 Key', () => {
    const result = checkAiConfig(VALID, '', true);
    expect(result.ok).toBe(true);
  });
});

describe('AI 配置存储', () => {
  it('默认不把 Key 写入 sessionStorage', async () => {
    const saved = await saveAiConfig(VALID, 'sk-memory');
    expect(saved.ok).toBe(true);
    expect(saved.hasKey).toBe(true);
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBeNull();
    expect(getAiKey()).toBe('sk-memory');

    const loaded = await loadAiConfig();
    expect(loaded.config.baseUrl).toBe(VALID.baseUrl);
    expect(loaded.hasKey).toBe(true);
  });

  it('勾选记住时写入 sessionStorage，并在清除后移除', async () => {
    await saveAiConfig({ ...VALID, rememberKey: true }, 'sk-session');
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBe('sk-session');

    await clearAiConfig();
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBeNull();
    expect(getAiKey()).toBeNull();
    const loaded = await loadAiConfig();
    expect(loaded.config).toEqual(DEFAULT_AI_CONFIG);
    expect(loaded.hasKey).toBe(false);
  });

  it('保存已有 Key 时留空可保留，关闭记住会移除 sessionStorage', async () => {
    await saveAiConfig({ ...VALID, rememberKey: true }, 'sk-keep');
    const saved = await saveAiConfig({ ...VALID, rememberKey: false }, '');
    expect(saved.ok).toBe(true);
    expect(getAiKey()).toBe('sk-keep');
    expect(window.sessionStorage.getItem('lrs.ai.key.v1')).toBeNull();
  });

  it('规范化地址与模型两端空白', async () => {
    const saved = await saveAiConfig(
      { ...VALID, baseUrl: `  ${VALID.baseUrl}  `, model: '  gpt-test  ' },
      'sk-test',
    );
    expect(saved.config.baseUrl).toBe(VALID.baseUrl);
    expect(saved.config.model).toBe('gpt-test');
  });

  it('非法配置不覆盖已有配置', async () => {
    await saveAiConfig(VALID, 'sk-first');
    const saved = await saveAiConfig({ ...VALID, baseUrl: '' }, '');
    expect(saved.ok).toBe(false);
    const loaded = await loadAiConfig();
    expect(loaded.config.baseUrl).toBe(VALID.baseUrl);
    expect(loaded.hasKey).toBe(true);
  });
});
