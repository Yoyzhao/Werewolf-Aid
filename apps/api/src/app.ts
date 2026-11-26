import Fastify, { type FastifyInstance } from 'fastify';

import type { HealthResponse } from '@lrs/shared';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get('/api/v1/health', async (): Promise<HealthResponse> => ({
    ok: true,
    version: '0.1.0',
  }));

  return app;
}
