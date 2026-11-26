import { describe, expect, it } from 'vitest';

import { API_VERSION } from './index';

describe('shared', () => {
  it('暴露当前 API 版本', () => {
    expect(API_VERSION).toBe('v1');
  });
});
