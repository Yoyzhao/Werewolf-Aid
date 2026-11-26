import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import { buildApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();

const https = config.httpsEnabled
  ? {
      key: readFileSync(config.tlsKeyPath),
      cert: readFileSync(config.tlsCertPath),
    }
  : undefined;

const app = await buildApp({ config, https });

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  console.error(error);
  process.exit(1);
}

let redirectServer: ReturnType<typeof createServer> | undefined;
if (config.httpsEnabled && config.httpRedirectPort > 0) {
  redirectServer = createServer((request, response) => {
    const host = config.publicOrigin
      ? new URL(config.publicOrigin).host
      : (request.headers.host ?? `localhost:${config.port}`).replace(/:\d+$/, '');
    response.writeHead(301, { location: `https://${host}${request.url ?? '/'}` });
    response.end();
  });

  try {
    await new Promise<void>((resolve, reject) => {
      redirectServer?.once('error', reject);
      redirectServer?.listen(config.httpRedirectPort, config.host, resolve);
    });
  } catch (error) {
    console.error(error);
    await app.close();
    process.exit(1);
  }
}

const shutdown = async (): Promise<void> => {
  redirectServer?.close();
  await app.close();
  process.exit(0);
};

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
