export const API_VERSION = 'v1' as const;

export interface HealthResponse {
  readonly ok: boolean;
  readonly version: string;
}
