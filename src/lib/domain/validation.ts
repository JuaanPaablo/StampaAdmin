import type { ContactKind, Program } from '../contracts';

export type ContactCheck = { ok: true; contact: string } | { ok: false; error: string };

/** Valida y normaliza el contacto de un cliente (WhatsApp: solo dígitos y +; correo en minúsculas). */
export function validateContact(kind: ContactKind, raw: string): ContactCheck {
  if (kind === 'email') {
    const s = (raw ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return { ok: false, error: 'Escribe un correo válido, por ejemplo nombre@correo.com.' };
    return { ok: true, contact: s };
  }
  const s = (raw ?? '').replace(/[\s\-().]/g, '');
  if (!/^\+?\d{9,15}$/.test(s)) return { ok: false, error: 'El WhatsApp debe tener entre 9 y 15 dígitos, por ejemplo 0991234567.' };
  return { ok: true, contact: s };
}

export function validateName(name: string | undefined): string | null {
  if (!name || name.trim().length < 2) return 'Escribe un nombre de al menos 2 letras.';
  if (name.trim().length > 80) return 'El nombre es demasiado largo (máximo 80 letras).';
  return null;
}

export function validatePin(pin: string | undefined): string | null {
  return pin && /^\d{4}$/.test(pin) ? null : 'El PIN debe tener exactamente 4 dígitos.';
}

export function validateBirthday(b: { d: number; m: number } | undefined): string | null {
  if (!b) return null;
  if (!Number.isInteger(b.m) || b.m < 0 || b.m > 11 || !Number.isInteger(b.d) || b.d < 1 || b.d > 31) return 'El cumpleaños no es válido.';
  return null;
}

/** Devuelve un mensaje en español si el cambio al programa no es válido, o null si está bien. */
export function validateProgramPatch(patch: Partial<Omit<Program, 'businessId'>>): string | null {
  const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v);
  if (patch.name !== undefined && patch.name.trim().length < 2) return 'El nombre de la tarjeta es muy corto.';
  if (patch.stampsRequired !== undefined && (!int(patch.stampsRequired) || patch.stampsRequired < 4 || patch.stampsRequired > 20)) return 'Los sellos para el premio deben estar entre 4 y 20.';
  if (patch.rewardTitle !== undefined && patch.rewardTitle.trim().length < 2) return 'Escribe cuál es el premio.';
  if (patch.minSpendCentsPerStamp !== undefined && (!int(patch.minSpendCentsPerStamp) || patch.minSpendCentsPerStamp < 0)) return 'El monto mínimo por sello no es válido.';
  if (patch.codeTtlSeconds !== undefined && (!int(patch.codeTtlSeconds) || patch.codeTtlSeconds < 30 || patch.codeTtlSeconds > 3600)) return 'La vigencia del código debe estar entre 30 segundos y 60 minutos.';
  if (patch.maxSeatsWithoutApproval !== undefined && (!int(patch.maxSeatsWithoutApproval) || patch.maxSeatsWithoutApproval < 1 || patch.maxSeatsWithoutApproval > 20)) return 'Los cupos sin aprobación deben estar entre 1 y 20.';
  if (patch.cooldownMinutes !== undefined && (!int(patch.cooldownMinutes) || patch.cooldownMinutes < 0 || patch.cooldownMinutes > 10080)) return 'La espera entre sellos no es válida.';
  if (patch.colors) {
    const hex = /^#[0-9a-fA-F]{6}$/;
    if (!hex.test(patch.colors.bg) || !hex.test(patch.colors.accent) || !hex.test(patch.colors.ink)) return 'Los colores deben ser hexadecimales, por ejemplo #001D3D.';
  }
  return null;
}
