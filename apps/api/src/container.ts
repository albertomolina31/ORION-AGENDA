import { AccessService } from './application/access-service.js';
import { AppointmentService } from './application/appointment-service.js';
import { BusinessService } from './application/business-service.js';
import { CampaignService } from './application/campaign-service.js';
import { BusinessSettingsService, ConfigService } from './application/config-service.js';
import { CustomerService } from './application/customer-service.js';
import { IdempotencyService } from './application/idempotency-service.js';
import { LoyaltySimulation } from './application/loyalty-simulation.js';
import { NotificationService } from './application/notification-service.js';
import { OutboxDispatcher } from './application/outbox-dispatcher.js';
import { PrivacyService } from './application/privacy-service.js';
import type { Repositories } from './application/ports.js';
import type { Clock } from './domain/clock.js';
import type { IdGenerator } from './domain/ids.js';
import { buildSeed } from './fixtures/seed.js';
import { MemoryDatabase } from './infrastructure/memory/memory-database.js';

/**
 * Raíz de composición independiente de NestJS: la usan el módulo HTTP y las pruebas.
 * Hoy solo existe la variante en memoria (simulación). La variante persistente se
 * añadirá al retomar D09 sin tocar los casos de uso.
 */
export interface OrionContainer {
  clock: Clock;
  db: MemoryDatabase;
  repos: Repositories;
  access: AccessService;
  idempotency: IdempotencyService;
  appointments: AppointmentService;
  customers: CustomerService;
  business: BusinessService;
  loyalty: LoyaltySimulation;
  campaigns: CampaignService;
  config: ConfigService;
  settings: BusinessSettingsService;
  notifications: NotificationService;
  privacy: PrivacyService;
  outbox: OutboxDispatcher;
}

export function createSimulationContainer(clock: Clock, ids: IdGenerator, seedAt: Date = clock.now()): OrionContainer {
  const seed = buildSeed(seedAt);
  const db = new MemoryDatabase(seed.db);
  const repos = db.repositories();
  const idempotency = new IdempotencyService(repos, db, clock);
  const appointments = new AppointmentService(repos, db, clock, ids, idempotency);
  const customers = new CustomerService(repos, clock, ids, idempotency);
  const business = new BusinessService(repos, clock, appointments);
  const loyalty = new LoyaltySimulation(seed.loyalty, repos, clock, ids, idempotency);
  const campaigns = new CampaignService(seed.campaigns, repos, clock, ids, idempotency, loyalty);
  const outbox = new OutboxDispatcher(repos);
  outbox.register((e) => loyalty.consume(e));
  return {
    clock,
    db,
    repos,
    access: new AccessService(repos),
    idempotency,
    appointments,
    customers,
    business,
    loyalty,
    campaigns,
    config: new ConfigService(repos, clock, ids, idempotency),
    settings: new BusinessSettingsService(repos, clock, idempotency, (a) => business.profile(a)),
    notifications: new NotificationService(repos, db, clock),
    privacy: new PrivacyService(repos, clock, ids, idempotency, (a, id) => customers.get(a, id)),
    outbox,
  };
}
