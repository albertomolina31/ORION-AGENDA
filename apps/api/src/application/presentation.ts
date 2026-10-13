import type { BusinessCategory, Vocabulary } from '@orion/contracts';

export const categoryLabel: Record<BusinessCategory, string> = {
  HAIR_BEAUTY: 'Peluquería y belleza',
  NAILS_BEAUTY: 'Manicura y belleza',
  CLINIC: 'Consultorio',
  CONSULTING: 'Consultoría',
  OTHER: 'Otro',
};

/** La profesión cambia la terminología, no los permisos. Valores iniciales editables. */
export function vocabularyFor(category: BusinessCategory): Vocabulary {
  return category === 'CLINIC'
    ? { customerSingular: 'Paciente', customerPlural: 'Pacientes' }
    : { customerSingular: 'Cliente', customerPlural: 'Clientes' };
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(Dra?\.|Lic\.)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

export function maskPhone(e164: string | null): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  return `•••• ••${digits.slice(-4, -2)} ${digits.slice(-2)}`;
}

/** Normaliza teléfonos mexicanos a E.164; no se usa para fusionar identidades (L12). */
export function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`;
  return `+${digits}`;
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
