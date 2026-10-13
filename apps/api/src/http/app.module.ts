import { Inject, Logger, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createSimulationContainer, type OrionContainer } from '../container.js';
import { SimulatedClock, SystemClock } from '../domain/clock.js';
import { RandomIdGenerator } from '../domain/ids.js';
import { ZONE } from '../fixtures/seed.js';
import {
  AppointmentsController,
  AuthController,
  BusinessController,
  CampaignsController,
  CustomersController,
  LoyaltyController,
  MeController,
  OperationsController,
  PrivacyController,
  SimulationController,
} from './controllers.js';
import { ErrorEnvelopeFilter } from './error-filter.js';
import { AuthGuard, BusinessGuard } from './guards.js';
import { SimulatedSessionStore } from './sessions.js';
import { CONTAINER, SESSIONS } from './tokens.js';

export function buildContainer(): OrionContainer {
  // ORION_CLOCK=system usa la hora real; por defecto la demo arranca hoy a las 09:41
  // (hora del negocio) para que la agenda sintética coincida con los diseños.
  const clock = process.env.ORION_CLOCK === 'system' ? new SystemClock() : new SimulatedClock(ZONE, process.env.ORION_CLOCK_START ?? '09:41');
  return createSimulationContainer(clock, new RandomIdGenerator());
}

@Module({
  controllers: [
    AuthController,
    MeController,
    OperationsController,
    BusinessController,
    AppointmentsController,
    CustomersController,
    LoyaltyController,
    CampaignsController,
    PrivacyController,
    SimulationController,
  ],
  providers: [
    { provide: CONTAINER, useFactory: buildContainer },
    { provide: SESSIONS, useClass: SimulatedSessionStore },
    { provide: APP_FILTER, useClass: ErrorEnvelopeFilter },
    AuthGuard,
    BusinessGuard,
  ],
})
export class AppModule implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private readonly logger = new Logger('Worker');

  constructor(@Inject(CONTAINER) private readonly c: OrionContainer) {}

  /** Worker en el mismo proceso: vencimientos y outbox. Sin Redis hasta que haga falta. */
  onModuleInit(): void {
    if (process.env.ORION_DISABLE_WORKER === '1') return;
    this.timer = setInterval(() => {
      void (async () => {
        try {
          const expired = await this.c.appointments.expireAllDue();
          const dispatched = await this.c.outbox.dispatchPending();
          if (expired || dispatched) this.logger.log(`expired=${expired} dispatched=${dispatched}`);
        } catch (err) {
          this.logger.error((err as Error).message);
        }
      })();
    }, 15_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
