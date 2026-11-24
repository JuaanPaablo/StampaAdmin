'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Después de una respuesta del servidor con errores, lleva el foco al primer campo marcado (aria-invalid="true").
 * `trigger` debe cambiar con cada respuesta (p. ej. el objeto de estado de useFormState).
 */
export function useFocusFirstError(formRef: RefObject<HTMLFormElement>, trigger: unknown, hasErrors: boolean) {
  useEffect(() => {
    if (!hasErrors) return;
    const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    el?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
