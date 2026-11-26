interface Entry {
  readonly value: unknown;
  readonly expiresAt: number;
}

/**
 * 单实例内存幂等缓存。P1 只部署一个 Node 进程；
 * 进程重启后幂等键失效，但不会破坏房间数据（重复创建会得到新房间）。
 */
export class IdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs = 10 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
    if (this.entries.size > 1000) this.prune();
  }

  private prune(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
