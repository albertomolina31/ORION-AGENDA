import { DateTime } from 'luxon';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationContainer, type OrionContainer } from '../src/container.js';
import { ManualClock } from '../src/domain/clock.js';
import { SequentialIdGenerator } from '../src/domain/ids.js';
import type { ActorContext } from '../src/domain/model.js';
import { ORBITA, ZONE } from '../src/fixtures/seed.js';

const START = DateTime.fromISO('2026-10-12T09:41:00', { zone: ZONE }).toJSDate();
const MARIANA = 'cus_001';
const DIEGO = 'cus_002';

let c: OrionContainer;
let owner: ActorContext;
let carmen: ActorContext;
let rocio: ActorContext;
let ana: ActorContext;
let rid = 0;
const req = () => `cst-${String(++rid).padStart(6, '0')}`;

beforeEach(async () => {
  c = createSimulationContainer(new ManualClock(START), new SequentialIdGenerator());
  owner = await c.access.resolveActor('u_alberto', ORBITA, 'test');
  carmen = await c.access.resolveActor('u_carmen', ORBITA, 'test');
  rocio = await c.access.resolveActor('u_rocio', ORBITA, 'test');
  ana = await c.access.resolveActor('u_ana', ORBITA, 'test');
});

async function diegoDuplicateId(): Promise<string> {
  const d = await c.customers.get(owner, DIEGO);
  expect(d.possibleDuplicates).toHaveLength(1);
  return d.possibleDuplicates[0]!.id;
}

describe('Editar ficha (rectificación)', () => {
  it('recepción corrige contacto y preferencias; el teléfono se normaliza', async () => {
    const updated = await c.customers.update(rocio, MARIANA, {
      requestId: req(),
      name: 'Mariana López Ruiz',
      phone: '669 123 4567',
      email: 'mariana@correo.test',
      note: 'Prefiere citas por la tarde',
      preferredProfessionalId: 'pro_sofia',
    });
    expect(updated).toMatchObject({ name: 'Mariana López Ruiz', email: 'mariana@correo.test', note: 'Prefiere citas por la tarde', preferredProfessional: { id: 'pro_sofia' } });
    expect(updated.phone).toBe('+526691234567');
  });

  it('un profesional no edita fichas; un profesional preferido inexistente se rechaza', async () => {
    await expect(c.customers.update(ana, MARIANA, { requestId: req(), name: 'X Y', phone: null, email: null, note: null, preferredProfessionalId: null })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      c.customers.update(owner, MARIANA, { requestId: req(), name: 'Mariana López', phone: null, email: null, note: null, preferredProfessionalId: 'pro_nadie' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('Notas internas por rol', () => {
  it('administración ve todas; recepción y profesional solo las del equipo', async () => {
    expect((await c.customers.get(owner, MARIANA)).notes.map((n) => n.visibility).sort()).toEqual(['ADMINS', 'TEAM']);
    expect((await c.customers.get(carmen, MARIANA)).notes).toHaveLength(2);
    expect((await c.customers.get(rocio, MARIANA)).notes.map((n) => n.visibility)).toEqual(['TEAM']);
    expect((await c.customers.get(ana, MARIANA)).notes.map((n) => n.visibility)).toEqual(['TEAM']);
  });

  it('el profesional puede dejar notas para el equipo, no restringidas; solo el autor o administración las borran', async () => {
    const withNote = await c.customers.addNote(ana, MARIANA, { requestId: req(), body: 'Pidió tinte sin amoniaco.' });
    const mine = withNote.notes.find((n) => n.body === 'Pidió tinte sin amoniaco.')!;
    expect(mine).toMatchObject({ authorName: 'Ana', visibility: 'TEAM', canDelete: true });
    await expect(c.customers.addNote(ana, MARIANA, { requestId: req(), body: 'Restringida', visibility: 'ADMINS' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(c.customers.deleteNote(rocio, MARIANA, mine.id, req())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const after = await c.customers.deleteNote(owner, MARIANA, mine.id, req());
    expect(after.notes.some((n) => n.id === mine.id)).toBe(false);
  });
});

describe('Unir duplicados (nunca automático)', () => {
  it('vista previa: qué se mueve, qué se completa y cómo queda el consentimiento', async () => {
    const dup = await diegoDuplicateId();
    await expect(c.customerMerge.preview(rocio, DIEGO, dup)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const p = await c.customerMerge.preview(owner, DIEGO, dup);
    expect(p.fieldsFilled).toContain('Correo');
    expect(p.loyalty).not.toBe('BLOCKED');
    expect(p.blockedReason).toBeNull();
  });

  it('une: mueve citas con historial, notas y consentimiento; el duplicado desaparece de listas', async () => {
    const dup = await diegoDuplicateId();
    // Una cita y una nota en el duplicado, y una baja de promociones en él.
    const appt = await c.appointments.create(owner, { requestId: req(), customerId: dup, serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: DateTime.fromISO('2026-10-13T16:00:00', { zone: ZONE }).toISO()! });
    await c.customers.addNote(owner, dup, { requestId: req(), body: 'Llegó por WhatsApp.' });
    await c.privacy.updateConsent(owner, dup, { requestId: req(), status: 'REVOKED' });
    const before = await c.customers.get(owner, DIEGO);

    const merged = await c.customerMerge.merge(owner, DIEGO, { requestId: req(), duplicateId: dup });
    expect(merged.email).toBe('diego.torres@correo.test');
    expect(merged.promotionalConsent).toBe('REVOKED'); // la baja prevalece
    expect(merged.notes.some((n) => n.body === 'Llegó por WhatsApp.')).toBe(true);
    expect(merged.nextAppointment?.appointmentId ?? merged.history.find((h) => h.appointmentId === appt.id)?.appointmentId).toBeTruthy();
    expect(merged.possibleDuplicates).toEqual([]);

    const detail = await c.appointments.get(owner, appt.id);
    expect(detail.customer.id).toBe(DIEGO);
    expect(detail.version).toBe(appt.version + 1);
    expect(detail.history.at(-1)?.reason).toMatch(/Cliente unificado/);

    await expect(c.customers.get(owner, dup)).rejects.toMatchObject({ code: 'NOT_FOUND', details: { mergedIntoId: DIEGO } });
    const list = await c.customers.list(owner, { q: 'Diego Torres', limit: 10 });
    expect(list.items.map((i) => i.id)).toEqual([DIEGO]);
    expect(before.completedVisits).toBeLessThanOrEqual(merged.completedVisits);

    // No se puede agendar con el registro unido.
    await expect(
      c.appointments.create(owner, { requestId: req(), customerId: dup, serviceId: 'svc_corte_clasico', professionalId: 'pro_luis', startsAt: DateTime.fromISO('2026-10-13T17:00:00', { zone: ZONE }).toISO()! }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('si ambos tienen tarjeta de fidelidad no se unen (regla pendiente del módulo de fidelidad)', async () => {
    const dup = await diegoDuplicateId();
    const ms = c.loyalty.state.memberships;
    if (!ms.some((m) => m.customerId === DIEGO)) ms.push({ id: 'mem_t1', businessId: ORBITA, customerId: DIEGO, stamps: 2, passUpdate: 'UP_TO_DATE' });
    ms.push({ id: 'mem_t2', businessId: ORBITA, customerId: dup, stamps: 1, passUpdate: 'UP_TO_DATE' });
    const p = await c.customerMerge.preview(owner, DIEGO, dup);
    expect(p.loyalty).toBe('BLOCKED');
    await expect(c.customerMerge.merge(owner, DIEGO, { requestId: req(), duplicateId: dup })).rejects.toMatchObject({ code: 'POLICY_VIOLATION' });
  });
});
