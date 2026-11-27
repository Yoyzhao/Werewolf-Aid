import { describe, expect, it } from 'vitest';

import {
  AI_FREE_TEXT_LIMIT,
  analyzeFreeText,
  detectSensitiveInfo,
  sanitizeFreeText,
} from './input-filter';

describe('sanitizeFreeText', () => {
  it('去除零宽字符与控制字符，保留换行', () => {
    expect(sanitizeFreeText('你\u200B好\u0000\n世界\uFEFF')).toBe('你好\n世界');
  });

  it('统一换行、制表符并合并连续空行', () => {
    expect(sanitizeFreeText('第一行\r\n\r\n\r\n\r\n第二行\t重点')).toBe('第一行\n\n第二行  重点');
  });

  it('保留首尾空白以便继续编辑', () => {
    expect(sanitizeFreeText('  文本  ')).toBe('  文本  ');
  });
});

describe('detectSensitiveInfo', () => {
  it('识别手机号、身份证与银行卡', () => {
    expect(detectSensitiveInfo('电话 13800138000')).toEqual(['phone']);
    expect(detectSensitiveInfo('身份证 11010519491231002X')).toEqual(['idCard']);
    expect(detectSensitiveInfo('卡号 6222 0202 0000 1234 567')).toEqual(['bankCard']);
  });

  it('不把普通数字误判为敏感信息', () => {
    expect(detectSensitiveInfo('3 号是狼人，第 2 轮投 7 号')).toEqual([]);
    expect(detectSensitiveInfo('12 人局，存活 8 人')).toEqual([]);
  });

  it('同一文本可命中多种类型且不泄露原值', () => {
    const kinds = detectSensitiveInfo('电话 13800138000，身份证 11010519491231002X');
    expect(kinds).toEqual(['phone', 'idCard']);
  });
});

describe('analyzeFreeText', () => {
  it('去首尾空白后计数，500 字以内可提交', () => {
    const result = analyzeFreeText(`  ${'甲'.repeat(AI_FREE_TEXT_LIMIT)}  `);
    expect(result.text).toHaveLength(AI_FREE_TEXT_LIMIT);
    expect(result.length).toBe(AI_FREE_TEXT_LIMIT);
    expect(result.overLimit).toBe(false);
  });

  it('超过 500 字标记超限', () => {
    const result = analyzeFreeText('甲'.repeat(AI_FREE_TEXT_LIMIT + 1));
    expect(result.overLimit).toBe(true);
    expect(result.limit).toBe(500);
  });

  it('过滤后再检测敏感信息', () => {
    const result = analyzeFreeText('电话 1\u200B3800138000');
    expect(result.text).toBe('电话 13800138000');
    expect(result.sensitive).toEqual(['phone']);
  });
});
