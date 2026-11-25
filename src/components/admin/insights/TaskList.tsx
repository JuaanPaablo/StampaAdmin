import Link from 'next/link';
import type { AdminTask } from '@/lib/contracts';
import { Badge, Card, EmptyState } from '@/components/ui';
import { cn } from '@/lib/cn';
import { num } from '@/lib/format';
import { ContactButton, SectionHeader, focusRing } from './bits';
import { SEVERITY_TEXT, SEVERITY_TONE, groupTasks, taskContact, taskSummary } from './helpers';

/** Cuántas tareas se ven sin abrir "Ver todas". */
export const VISIBLE_TASKS = 8;

function TaskRow({ task }: { task: AdminTask }) {
  const contact = taskContact(task);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
      <Link href={`/admin/negocios/${task.businessId}`}
        className={cn('-mx-2 flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-lg px-2 py-1 hover:bg-surface', focusRing)}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="min-w-0 truncate font-semibold text-navy">{task.businessName}</span>
          <Badge tone={SEVERITY_TONE[task.severity]}>{task.label}</Badge>
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{task.reason}</span>
      </Link>
      {contact && <div className="shrink-0"><ContactButton href={contact.href} channel={contact.channel} who={task.businessName} /></div>}
    </li>
  );
}

function Groups({ tasks }: { tasks: AdminTask[] }) {
  return (
    <>
      {groupTasks(tasks).map((g) => (
        <div key={g.severity}>
          <h3 className="flex items-center gap-2 border-b border-line bg-surface/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:px-5">
            {SEVERITY_TEXT[g.severity]}
            <span className="tabular-nums">· {num(g.tasks.length)}</span>
          </h3>
          <ul className="divide-y divide-line">
            {g.tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          </ul>
        </div>
      ))}
    </>
  );
}

/** "Hoy te toca": tareas del día ordenadas por gravedad, con atajo para escribir al dueño. */
export function TaskList({ tasks }: { tasks: AdminTask[] }) {
  const visible = tasks.slice(0, VISIBLE_TASKS);
  const rest = tasks.slice(VISIBLE_TASKS);
  return (
    <section aria-labelledby="hoy">
      <SectionHeader id="hoy" title="Hoy te toca" text={tasks.length ? taskSummary(tasks) : undefined} />
      {tasks.length === 0 ? (
        <EmptyState title="Todo en orden" text="No hay cobros cercanos, planes vencidos ni negocios sin movimiento." />
      ) : (
        <Card className="overflow-hidden !p-0">
          <Groups tasks={visible} />
          {rest.length > 0 && (
            <details className="group border-t border-line">
              <summary className={cn('flex min-h-[48px] cursor-pointer list-none items-center justify-center gap-2 px-4 text-sm font-semibold text-navy hover:bg-surface [&::-webkit-details-marker]:hidden', focusRing)}>
                <span className="group-open:hidden">Ver todas ({num(tasks.length)})</span>
                <span className="hidden group-open:inline">Ver menos</span>
                <span aria-hidden="true" className="transition group-open:rotate-180">▾</span>
              </summary>
              <div className="border-t border-line">
                <Groups tasks={rest} />
              </div>
            </details>
          )}
        </Card>
      )}
    </section>
  );
}
