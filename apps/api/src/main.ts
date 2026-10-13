import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NextFunction, Response } from 'express';
import { AppModule } from './http/app.module.js';
import type { OrionRequest } from './http/request-context.js';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('v1');
  // Desarrollo: permitir la app web de Expo. En staging/producción se restringe.
  app.enableCors({ origin: true, allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'] });
  app.use((req: OrionRequest, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    req.requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    res.setHeader('X-Orion-Data-Source', 'SIMULATION');
    next();
  });
  return app;
}

if (process.env.VITEST === undefined) {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Orion API (SIMULACIÓN en memoria) escuchando en http://localhost:${port}/v1`);
}
