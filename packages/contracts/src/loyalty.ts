import { z } from 'zod';
import { Id, IsoDateTime, RequestId } from './common.js';

/**
 * Contrato de fidelidad (propietario: Sergio). Alberto solo consume.
 * La app nunca calcula saldos ni incrementa contadores localmente (L15).
 */
export const RewardType = z.enum(['PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_SERVICE']);

export const LoyaltyProgram = z.object({
  id: Id,
  businessId: Id,
  version: z.number().int().positive(),
  status: z.enum(['ACTIVE', 'DRAFT', 'DISABLED']),
  name: z.string(),
  stampsRequired: z.number().int().positive(),
  eligibleServiceIds: z.array(Id),
  reward: z.object({
    type: RewardType,
    value: z.number().nonnegative(),
    serviceId: Id.nullable(),
    description: z.string(),
  }),
  stampExpiry: z.enum(['NEVER', 'DAYS_365', 'DAYS_180']),
  rewardValidityDays: z.number().int().positive(),
  wallet: z.object({
    apple: z.enum(['NOT_LINKED', 'LINKED', 'ERROR']),
    google: z.enum(['NOT_LINKED', 'LINKED', 'ERROR']),
  }),
  /** Valores de ejemplo hasta que Sergio y Alberto aprueben reglas. */
  isExampleConfiguration: z.boolean(),
});
export type LoyaltyProgram = z.infer<typeof LoyaltyProgram>;

export const LoyaltyMembership = z.object({
  id: Id,
  customerId: Id,
  customerName: z.string(),
  stamps: z.number().int().nonnegative(),
  stampsRequired: z.number().int().positive(),
  passUpdate: z.enum(['UP_TO_DATE', 'PENDING', 'NOT_ISSUED']),
  availableRewards: z.array(
    z.object({
      id: Id,
      description: z.string(),
      serviceName: z.string().nullable(),
      status: z.enum(['AVAILABLE', 'REDEEMED', 'EXPIRED']),
      validUntil: IsoDateTime,
    }),
  ),
});
export type LoyaltyMembership = z.infer<typeof LoyaltyMembership>;

export const RedeemRequest = z.object({
  requestId: RequestId,
  rewardId: Id,
  appointmentId: Id.nullable(),
});
export type RedeemRequest = z.infer<typeof RedeemRequest>;

export const RedemptionResult = z.object({
  redemptionId: Id,
  rewardId: Id,
  status: z.literal('REDEEMED'),
  redeemedAt: IsoDateTime,
});
export type RedemptionResult = z.infer<typeof RedemptionResult>;
