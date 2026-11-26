import { ROLE_DEFINITIONS, type RoleId } from './roles.js';
import type { DeathCause, GameState, NightAction, Winner, WitchPotion } from './state-machine.js';

export interface NightDeath {
  readonly seatNo: number;
  readonly cause: DeathCause;
}

export interface RuleViolation {
  readonly code: 'INVALID_ACTION' | 'INVALID_TARGET';
  readonly message: string;
}

function roundActions(state: GameState): readonly NightAction[] {
  return state.nightActions.filter((action) => action.round === state.round);
}

export function computeNightDeaths(state: GameState): NightDeath[] {
  const actions = roundActions(state);
  const guard = actions.find((action) => action.roleId === 'GUARD');
  const wolf = actions.find((action) => action.roleId === 'WOLF');
  const witch = actions.find((action) => action.roleId === 'WITCH');

  const deaths = new Map<number, DeathCause>();
  const wolfTarget = wolf?.target ?? null;

  if (wolfTarget !== null) {
    const guarded = guard?.target === wolfTarget;
    const saved = witch?.potion === 'ANTIDOTE' && witch.target === wolfTarget;
    if (guarded && saved) {
      deaths.set(wolfTarget, 'SAME_GUARD_SAVE');
    } else if (!guarded && !saved) {
      deaths.set(wolfTarget, 'WOLF');
    }
  }

  if (witch?.potion === 'POISON' && witch.target !== null && !deaths.has(witch.target)) {
    deaths.set(witch.target, 'POISON');
  }

  return [...deaths.entries()].map(([seatNo, cause]) => ({ seatNo, cause }));
}

export function checkWin(state: GameState): Winner | null {
  const alive = state.seats.filter((seat) => seat.alive && seat.role !== null);
  const wolves = alive.filter((seat) => seat.role && ROLE_DEFINITIONS[seat.role].camp === 'wolf');
  if (wolves.length === 0) return 'good';

  const gods = alive.filter((seat) => seat.role && ROLE_DEFINITIONS[seat.role].kind === 'god');
  const villagers = alive.filter(
    (seat) => seat.role && ROLE_DEFINITIONS[seat.role].kind === 'villager',
  );
  if (gods.length === 0 || villagers.length === 0) return 'wolf';

  return null;
}

function previousRoundAction(state: GameState, roleId: RoleId): NightAction | undefined {
  return state.nightActions.find(
    (action) => action.round === state.round - 1 && action.roleId === roleId,
  );
}

export function validateNightActionRules(
  state: GameState,
  action: { roleId: RoleId; target: number | null; potion?: WitchPotion },
): RuleViolation | null {
  if (action.roleId === 'GUARD' && action.target !== null) {
    const previous = previousRoundAction(state, 'GUARD');
    if (previous && previous.target === action.target) {
      return { code: 'INVALID_TARGET', message: '守卫不可连续两夜守护同一人' };
    }
  }

  if (action.roleId !== 'WITCH' || !action.potion) return null;

  const potion = action.potion;
  const usedInRound = roundActions(state).some((item) => item.potion !== null);
  if (usedInRound) {
    return { code: 'INVALID_ACTION', message: '女巫每夜至多使用一瓶药' };
  }
  const usedBefore = state.nightActions.some(
    (item) => item.round < state.round && item.potion === potion,
  );
  if (usedBefore) {
    return {
      code: 'INVALID_ACTION',
      message: potion === 'ANTIDOTE' ? '解药已用完' : '毒药已用完',
    };
  }

  if (potion === 'ANTIDOTE') {
    const wolf = roundActions(state).find((item) => item.roleId === 'WOLF');
    if (!wolf || wolf.target === null) {
      return { code: 'INVALID_TARGET', message: '本夜无人被刀，无法使用解药' };
    }
    if (action.target !== wolf.target) {
      return { code: 'INVALID_TARGET', message: '解药只能救当夜被刀者' };
    }
    if (state.round === 1 && !state.options.witchSelfSaveFirstNight) {
      const witchSeat = state.seats.find((seat) => seat.role === 'WITCH')?.no;
      if (witchSeat === action.target) {
        return { code: 'INVALID_TARGET', message: '本局未开启女巫首夜自救' };
      }
    }
  }

  return null;
}
