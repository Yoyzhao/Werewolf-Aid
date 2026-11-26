import type { ApiErrorCode } from '@lrs/shared';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  readonly status: number;

  readonly details?: unknown;

  readonly headers?: Readonly<Record<string, string>>;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    details?: unknown,
    headers?: Readonly<Record<string, string>>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.headers = headers;
  }
}
