'use client';

import type { SelectHTMLAttributes } from 'react';
import { Select } from '@/components/ui';

/** Select que envía su formulario al cambiar (p. ej. el orden de la lista), sin tener que pulsar "Buscar". */
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <Select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
