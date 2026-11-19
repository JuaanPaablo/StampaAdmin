import { Isotipo, Wordmark } from '@/components/shell/logo';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Iniciar sesión · Stampa' };

const POINTS = [
  'Sellos digitales en lugar de tarjetas de cartón.',
  'Cada sello se valida con un código, sin trampas.',
  'Sabe quién vuelve, cuándo y qué premio le toca.'
];

/** Tarjeta de sellos decorativa: 8 casillas, 5 selladas. */
function StampCard() {
  const cells = Array.from({ length: 8 }, (_, i) => i);
  return (
    <svg viewBox="0 0 320 170" className="w-full max-w-[320px]" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="318" height="168" rx="18" fill="#0F2A4A" stroke="#1F4570" strokeWidth="2" />
      <rect x="22" y="22" width="60" height="8" rx="4" fill="#1F4570" />
      <rect x="22" y="38" width="96" height="6" rx="3" fill="#1A3A60" />
      {cells.map((i) => {
        const cx = 55 + (i % 4) * 70;
        const cy = 92 + Math.floor(i / 4) * 48;
        const done = i < 5;
        return done ? (
          <g key={i}>
            <circle cx={cx} cy={cy} r="19" fill="#FFC301" />
            <path d={`M${cx - 7} ${cy} l5 5 l10 -10`} fill="none" stroke="#001D3D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ) : (
          <circle key={i} cx={cx} cy={cy} r="19" fill="none" stroke="#3A5F89" strokeWidth="2" strokeDasharray="4 5" />
        );
      })}
    </svg>
  );
}

export default function IngresarPage({ searchParams }: { searchParams?: { next?: string | string[] } }) {
  const raw = Array.isArray(searchParams?.next) ? searchParams?.next[0] : searchParams?.next;
  const next = raw && raw.startsWith('/panel') && !raw.startsWith('//') ? raw : undefined;

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-12 text-white lg:flex xl:px-16">
        <Isotipo size={420} color="#0F2A4A" dot="#0F2A4A" className="pointer-events-none absolute -bottom-24 -right-28 opacity-70" />
        <div className="relative"><Wordmark /></div>
        <div className="relative flex max-w-md flex-col gap-8">
          <h2 className="font-display text-4xl font-bold leading-[1.1] tracking-tight xl:text-[44px]">Fideliza a tus clientes, sello a sello</h2>
          <ul className="flex flex-col gap-3.5 text-[15px] leading-snug text-[#C9D6E3]">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3">
                <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-sun" aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <StampCard />
        </div>
        <p className="relative text-xs text-[#8DA2B8]">Acceso para equipos de negocios en Stampa.</p>
      </aside>

      <section className="flex flex-col px-5 py-8 sm:px-10 lg:px-14">
        <div className="mb-10 flex justify-center lg:hidden"><Wordmark dark /></div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
          <h1 className="font-display text-[28px] font-bold tracking-tight text-navy">Iniciar sesión</h1>
          <p className="mt-1.5 text-sm text-muted">Ingresa con el correo y la contraseña de tu cuenta Stampa.</p>
          <div className="mt-8"><LoginForm next={next} /></div>
          <p className="mt-10 text-center text-sm text-muted">
            ¿Aún no eres cliente?{' '}
            <a href="mailto:hola@stampa.app" className="rounded font-semibold text-navy underline underline-offset-2">Escríbenos</a>
          </p>
        </div>
        <p className="mt-8 text-center text-xs text-muted">© {new Date().getFullYear()} Stampa</p>
      </section>
    </main>
  );
}
