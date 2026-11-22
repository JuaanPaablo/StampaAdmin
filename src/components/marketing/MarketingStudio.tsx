'use client';

import { useEffect, useState, useTransition } from 'react';
import { generateMarketingAction } from '@/app/panel/marketing/actions';
import { btnClass, Card, inputClass } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Insight, InsightLayout } from '@/lib/marketing/insights';
import type { CalendarDay, PostOption } from '@/lib/marketing/prompts';
import type { GenerateResult, Quota } from '@/lib/marketing/service';
import type { MarketingPhoto } from '@/lib/contracts';
import { DESIGN_LABEL, PHOTO_DESIGNS, PLAIN_DESIGNS, type PhotoAdvice, type PostDesign } from '@/lib/marketing/photos';
import { PhotoPanel, type PhotoChoice } from './PhotoPanel';

type Tab = 'ideas' | 'post' | 'semana' | 'resenas';
type Design = PostDesign;

const CHANNELS = ['Instagram', 'Facebook', 'TikTok', 'Estado de WhatsApp'] as const;
const label = 'text-xs font-semibold tracking-wide text-muted';

export interface StudioProps {
  quota: Quota;
  insights: Insight[];
  can: { dataPosts: boolean; calendar: boolean; reviews: boolean };
  coverUrl?: string;
  photos: MarketingPhoto[];
  imageQuota: Quota;
  advice: PhotoAdvice[];
  aiImagesReady: boolean;
  locks: { ideas: React.ReactNode; semana: React.ReactNode; resenas: React.ReactNode };
}

/** Parámetro "ph" de la imagen: id de una foto subida o "portada". */
const photoParam = (p: PhotoChoice) => (p?.kind === 'photo' ? p.id : p?.kind === 'portada' ? 'portada' : undefined);

function imageUrl(d: Design, o: { titulo: string; subtitulo?: string }, big: string | undefined, story: boolean, dl = false, ph?: string) {
  const q = new URLSearchParams({ d, t: o.titulo, f: story ? 'story' : 'sq' });
  if (ph) q.set('ph', ph);
  if (o.subtitulo) q.set('s', o.subtitulo);
  if (big) q.set('b', big);
  if (dl) q.set('dl', '1');
  return '/panel/marketing/imagen?' + q.toString();
}

function CopyButton({ text, children = 'Copiar texto' }: { text: string; children?: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={btnClass('dark', 'sm')} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* sin permiso */ }
    }}>{done ? '¡Copiado!' : children}</button>
  );
}

/** Guía visual del flujo: foto → mejora → texto → imagen. */
function Steps({ done }: { done: boolean[] }) {
  const steps = [
    { n: 1, t: 'Foto', why: 'Tu producto real' },
    { n: 2, t: 'Mejora', why: 'Opcional, con IA' },
    { n: 3, t: 'Texto', why: 'La IA lo escribe' },
    { n: 4, t: 'Imagen', why: 'Lista para publicar' }
  ];
  const current = done.findIndex((d) => !d);
  return (
    <ol className="grid grid-cols-4 gap-1.5 sm:gap-3" aria-label="Pasos">
      {steps.map((s, i) => {
        const ok = done[i];
        const now = i === current;
        return (
          <li key={s.n} aria-current={now ? 'step' : undefined}
            className={cn('flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-center sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left', now ? 'bg-navy text-white' : 'bg-surface text-navy')}>
            <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-full font-display text-sm font-bold', ok ? 'bg-[#DDF3E8] text-[#12683F]' : now ? 'bg-sun text-navy' : 'bg-white text-muted')}>{ok ? '✓' : s.n}</span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold sm:text-sm">{s.t}</span>
              <span className={cn('hidden truncate text-xs sm:block', now ? 'text-white/75' : 'text-muted')}>{s.why}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Una opción de post: imagen con la marca, texto editable y botones para copiar y descargar. */
function PostCard({ o, n, layout, big, ph }: { o: PostOption; n: number; layout?: InsightLayout; big?: string; ph?: string }) {
  // Cada opción arranca con un diseño distinto; si cambia la foto, se pasa al juego de diseños que corresponde.
  const pick = (withPhoto: boolean): Design => withPhoto
    ? (['impacto', 'dividido', 'limpio'] as const)[n % 3]
    : n === 0 ? (layout === 'numero' && big ? 'numero' : 'color') : n === 1 ? 'claro' : big ? 'numero' : 'color';
  const [design, setDesign] = useState<Design>(pick(!!ph));
  useEffect(() => { setDesign(pick(!!ph)); }, [!!ph]); // eslint-disable-line react-hooks/exhaustive-deps
  const designs = (ph ? PHOTO_DESIGNS : PLAIN_DESIGNS).filter((d) => d !== 'numero' || big);
  const [text, setText] = useState(o.texto + (o.hashtags.length ? '\n\n' + o.hashtags.map((h) => '#' + h).join(' ') : ''));
  const [title, setTitle] = useState(o.titulo);
  const [sub, setSub] = useState(o.subtitulo);
  // La imagen se regenera 600 ms después de dejar de escribir, no con cada letra.
  const [view, setView] = useState({ titulo: o.titulo, subtitulo: o.subtitulo });
  useEffect(() => {
    const t = setTimeout(() => setView({ titulo: title, subtitulo: sub }), 600);
    return () => clearTimeout(t);
  }, [title, sub]);
  return (
    <article className="grid gap-4 rounded-2xl bg-surface p-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl(design, view, big, false, false, ph)} alt={`Imagen del post: ${title}`} loading="lazy"
          className="aspect-square w-full rounded-xl bg-white object-cover shadow-sm" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Diseño de la imagen">
          {designs.map((d) => (
            <button key={d} type="button" aria-pressed={design === d} onClick={() => setDesign(d)}
              className={cn('rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', design === d ? 'bg-navy text-white ring-navy' : 'bg-white text-navy ring-[#C9D6E3]')}>
              {DESIGN_LABEL[d]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <p className={label}>Opción {n + 1}</p>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Título de la imagen</span>
          <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Subtítulo de la imagen</span>
          <input value={sub} maxLength={110} onChange={(e) => setSub(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Texto para publicar</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className={cn(inputClass, 'h-auto py-2.5 leading-relaxed')} />
        </label>
        {/\[[^\]]+\]/.test(text + title + sub) &&<p className="rounded-xl bg-[#FFF4CC] px-3 py-2 text-xs text-navy">Completa lo que está entre corchetes antes de publicar.</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton text={text} />
          <a href={imageUrl(design, view, big, false, true, ph)} className={btnClass('ghost', 'sm')}>Descargar imagen</a>
          <a href={imageUrl(design, view, big, true, true, ph)} className={btnClass('ghost', 'sm')}>Descargar para historia</a>
        </div>
      </div>
    </article>
  );
}

export function MarketingStudio({ quota: initialQuota, insights, can, coverUrl, photos, imageQuota, advice, aiImagesReady, locks }: StudioProps) {
  const [photo, setPhoto] = useState<PhotoChoice>(null);
  const ph = photoParam(photo);
  const [tab, setTab] = useState<Tab>(can.dataPosts && insights.length ? 'ideas' : 'post');
  const [quota, setQuota] = useState(initialQuota);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tab: Tab; options?: PostOption[]; days?: CalendarDay[]; replies?: string[]; insight?: Insight; sample?: boolean } | null>(null);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('Instagram');
  const [topic, setTopic] = useState('');
  const [review, setReview] = useState('');
  const [stars, setStars] = useState(5);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(false);

  function run(req: unknown, t: Tab, insight?: Insight) {
    setError(null);
    setBusyId(insight?.id ?? t);
    start(async () => {
      const r: GenerateResult = await generateMarketingAction(req);
      setBusyId(null);
      if (r.quota) setQuota(r.quota);
      if (!r.ok) { setError(r.error); return; }
      setResult({ tab: t, options: r.options, days: r.days, replies: r.replies, insight, sample: r.sample });
      setTimeout(() => document.getElementById('resultado')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'ideas', label: 'Ideas con tus datos' }, { id: 'post', label: 'Post libre' }, { id: 'semana', label: 'Tu semana' }, { id: 'resenas', label: 'Reseñas' }
  ];
  const noQuota = quota.left <= 0;
  const channelPicker = (
    <label className="flex flex-col gap-1.5">
      <span className={label}>¿Dónde lo vas a publicar?</span>
      <select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} className={cn(inputClass, 'w-full pr-8 sm:w-56')}>
        {CHANNELS.map((c) => <option key={c}>{c}</option>)}
      </select>
    </label>
  );

  return (
    <div className="flex flex-col gap-6">
      <Steps done={[!!photo, enhanced || photo?.kind === 'portada', !!result, !!result?.options?.length]} />

      <PhotoPanel photos={photos} coverUrl={coverUrl} quota={imageQuota} advice={advice} value={photo}
        onChange={(p) => { setPhoto(p); setEnhanced(false); }} onEnhanced={() => setEnhanced(true)} aiReady={aiImagesReady} />

      <div className="-mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="font-display text-lg font-semibold text-navy">Tu texto</h2>
        <div className="flex items-center gap-2 text-xs text-muted" title="Se renuevan el 1 de cada mes. Las fotos no cuentan.">
          <span>Textos IA <strong className="text-navy">{quota.used}/{quota.limit}</strong></span>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-[#E3EAF2]" role="meter" aria-valuemin={0} aria-valuemax={quota.limit} aria-valuenow={quota.used} aria-label="Textos usados este mes">
            <div className={cn('h-full rounded-full', quota.left <= 0 ? 'bg-bad' : 'bg-navy')} style={{ width: `${Math.min(100, (quota.used / Math.max(1, quota.limit)) * 100)}%` }} />
          </div>
        </div>
      </div>
      {noQuota && <p className="-mb-2 rounded-xl bg-[#FFF3CC] px-3 py-2 text-sm text-[#7A5A00]">Ya usaste tus textos de este mes. Se renuevan el día 1.</p>}

      <nav className="flex flex-wrap gap-2" aria-label="Herramientas de marketing">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => { setTab(t.id); setError(null); }}
            className={cn(btnClass(tab === t.id ? 'dark' : 'ghost', 'sm'), 'shrink-0')}>{t.label}</button>
        ))}
      </nav>

      {tab === 'ideas' && (!can.dataPosts ? locks.ideas : (
        <section className="flex flex-col gap-4" aria-label="Ideas con tus datos">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="max-w-2xl text-sm text-muted">Según tus últimos 30 días.</p>
            {channelPicker}
          </div>
          {insights.length === 0 ? (
            <Card><p className="text-sm text-muted">Aún faltan datos: aparecerán cuando tus clientes sumen sellos.</p></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((i) => (
                <Card key={i.id} className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    {i.big && <span className="shrink-0 rounded-xl bg-[#FFF3CC] px-3 py-1.5 font-display text-xl font-bold text-navy">{i.big}</span>}
                    <div className="min-w-0">
                      <h3 className="font-display text-base font-semibold text-navy">{i.title}</h3>
                      <p className="mt-1 text-sm text-muted">{i.detail}</p>
                    </div>
                  </div>
                  <button type="button" disabled={pending || noQuota} onClick={() => run({ kind: 'data_post', insightId: i.id, channel }, 'ideas', i)}
                    className={cn(btnClass('primary', 'sm'), 'self-start')}>{busyId === i.id ? 'Escribiendo…' : 'Crear post'}</button>
                </Card>
              ))}
            </div>
          )}
        </section>
      ))}

      {tab === 'post' && (
        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={label}>¿De qué quieres el post?</span>
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} rows={3}
              placeholder="Ej. Lanzamos la pizza de chorizo con maduro esta semana."
              className={cn(inputClass, 'h-auto py-2.5')} />
            <span className="text-xs text-muted">Producto, fecha o promo. La IA no inventa precios.</span>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            {channelPicker}
            <button type="button" disabled={pending || noQuota || topic.trim().length < 3} onClick={() => run({ kind: 'post', topic, channel }, 'post')}
              className={btnClass('primary')}>{busyId === 'post' ? 'Escribiendo…' : 'Generar 3 opciones'}</button>
          </div>
        </Card>
      )}

      {tab === 'semana' && (!can.calendar ? locks.semana : (
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-muted">5 posts de lunes a viernes · cuenta como 1 texto.</p>
          <button type="button" disabled={pending || noQuota} onClick={() => run({ kind: 'calendar' }, 'semana')}
            className={cn(btnClass('primary'), 'self-start')}>{busyId === 'semana' ? 'Armando tu semana…' : 'Armar mi semana'}</button>
        </Card>
      ))}

      {tab === 'resenas' && (!can.reviews ? locks.resenas : (
        <Card className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Pega la reseña de Google</span>
            <textarea value={review} onChange={(e) => setReview(e.target.value)} maxLength={1500} rows={4} className={cn(inputClass, 'h-auto py-2.5')} />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Estrellas</span>
              <select value={stars} onChange={(e) => setStars(Number(e.target.value))} className={cn(inputClass, 'w-32 pr-8')}>
                {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{'★'.repeat(s)}</option>)}
              </select>
            </label>
            <button type="button" disabled={pending || noQuota || review.trim().length < 5} onClick={() => run({ kind: 'review_reply', review, stars }, 'resenas')}
              className={btnClass('primary')}>{busyId === 'resenas' ? 'Escribiendo…' : 'Escribir respuesta'}</button>
          </div>
        </Card>
      ))}

      <p role="status" aria-live="polite" className={cn('text-sm', error ? 'font-medium text-bad' : 'sr-only')}>{error ?? (pending ? 'Generando…' : '')}</p>

      {result && result.tab === tab && (
        <section id="resultado" className="flex scroll-mt-6 flex-col gap-4" aria-label="Resultado">
          <h2 className="font-display text-lg font-semibold text-navy">{result.options ? `Tu imagen${result.insight ? ': ' + result.insight.title : ''}` : 'Resultado'}</h2>
          {result.sample && <p className="rounded-xl bg-[#FFF4CC] px-3 py-2 text-xs text-navy">Texto de ejemplo: en este entorno no hay clave de IA.</p>}
          {result.options?.map((o, n) => <PostCard key={n + o.titulo} o={o} n={n} layout={result.insight?.layout} big={result.insight?.big} ph={ph} />)}
          {result.days?.map((d, n) => (
            <article key={n} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <p className="font-display text-base font-semibold capitalize text-navy">{d.dia}: <span className="normal-case">{d.idea}</span></p>
              <p className="whitespace-pre-line text-sm text-navy">{d.texto}</p>
              {d.hashtags.length > 0 && <p className="text-sm text-muted">{d.hashtags.map((h) => '#' + h).join(' ')}</p>}
              <div className="flex flex-wrap gap-2">
                <CopyButton text={d.texto + (d.hashtags.length ? '\n\n' + d.hashtags.map((h) => '#' + h).join(' ') : '')} />
                <a href={imageUrl(ph ? 'impacto' : 'color', { titulo: d.titulo || d.idea.slice(0, 40) }, undefined, false, true, ph)} className={btnClass('ghost', 'sm')}>Descargar imagen</a>
              </div>
            </article>
          ))}
          {result.replies?.map((r, n) => (
            <article key={n} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
              <p className={label}>Respuesta {n + 1}</p>
              <p className="whitespace-pre-line text-sm text-navy">{r}</p>
              <CopyButton text={r} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
