export interface HostRoomBinding {
  readonly roomId: string;
  readonly code: string;
  readonly hostToken: string;
  readonly boardId: string;
  readonly createdAt: number;
}

export interface PlayerRoomBinding {
  readonly code: string;
  readonly seatNo: number;
  readonly savedAt: number;
}

const HOST_KEY = 'lrs.room.host.v1';
const PLAYER_KEY = 'lrs.room.player.v1';

function isCode(value: unknown): value is string {
  return typeof value === 'string' && /^\d{6}$/.test(value);
}

export function loadHostBinding(): HostRoomBinding | null {
  try {
    const raw = window.localStorage.getItem(HOST_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<HostRoomBinding>;
    if (
      typeof value.roomId !== 'string' ||
      !isCode(value.code) ||
      typeof value.hostToken !== 'string' ||
      !value.hostToken ||
      typeof value.boardId !== 'string' ||
      typeof value.createdAt !== 'number'
    ) {
      return null;
    }
    return {
      roomId: value.roomId,
      code: value.code,
      hostToken: value.hostToken,
      boardId: value.boardId,
      createdAt: value.createdAt,
    };
  } catch {
    return null;
  }
}

export function saveHostBinding(binding: HostRoomBinding): void {
  try {
    window.localStorage.setItem(HOST_KEY, JSON.stringify(binding));
  } catch {
    // 本机存储不可用时仅影响刷新恢复，不阻塞房间使用。
  }
}

export function clearHostBinding(): void {
  try {
    window.localStorage.removeItem(HOST_KEY);
  } catch {
    // 忽略存储异常。
  }
}

export function loadPlayerBinding(): PlayerRoomBinding | null {
  try {
    const raw = window.localStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PlayerRoomBinding>;
    if (
      !isCode(value.code) ||
      typeof value.seatNo !== 'number' ||
      typeof value.savedAt !== 'number'
    ) {
      return null;
    }
    return { code: value.code, seatNo: value.seatNo, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function savePlayerBinding(binding: PlayerRoomBinding): void {
  try {
    window.localStorage.setItem(PLAYER_KEY, JSON.stringify(binding));
  } catch {
    // 忽略存储异常。
  }
}

export function clearPlayerBinding(): void {
  try {
    window.localStorage.removeItem(PLAYER_KEY);
  } catch {
    // 忽略存储异常。
  }
}
