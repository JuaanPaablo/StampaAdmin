import Link from 'next/link';
import { btnClass } from '@/components/ui';
import { stampaWhatsappUrl } from '@/lib/urls';

/** Contenido de "Este enlace ya no sirve" (sin estado: sirve en páginas de servidor y en formularios cliente). */
export function InvalidLinkBody({ mode }: { mode: 'invite' | 'reset' }) {
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed text-navy">
      <p className="text-muted">Ya se usó o venció ({mode === 'reset' ? 'dura 60 minutos' : 'dura 72 horas'}).</p>
      {mode === 'reset' ? (
        <>
          <Link href="/ingresar/olvide" className={btnClass('primary') + ' h-12 w-full'}>Pedir otro enlace</Link>
          <Link href="/ingresar" className={btnClass('ghost') + ' h-12 w-full'}>Ir a iniciar sesión</Link>
        </>
      ) : (
        <>
          <div className="rounded-xl bg-surface px-4 py-3.5">
            <p className="font-semibold">¿Eres el dueño? Te enviamos otro.</p>
            <a
              href={stampaWhatsappUrl('Hola, mi enlace de acceso a Stampa ya no sirve. ¿Me pueden enviar uno nuevo?')}
              target="_blank" rel="noopener noreferrer" className={btnClass('primary') + ' mt-3 h-12 w-full'}
            >
              Escribir a Stampa por WhatsApp
            </a>
          </div>
          <div className="rounded-xl bg-surface px-4 py-3.5">
            <p className="font-semibold">¿Eres del equipo?</p>
            <p className="mt-1 text-muted">Pide un enlace nuevo a tu dueño o gerente.</p>
          </div>
          <Link href="/ingresar" className="text-center font-semibold text-navy underline underline-offset-2">¿Ya tienes contraseña? Inicia sesión</Link>
        </>
      )}
    </div>
  );
}
