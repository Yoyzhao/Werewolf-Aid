import { describe, expect, it } from 'vitest';

import { GAME_ENGINE_VERSION } from './index.js';

describe('game-engine', () => {
  it('暴露脚手架版本', () => {
    expect(GAME_ENGINE_VERSION).toBe('0.1.0');
  });
});
