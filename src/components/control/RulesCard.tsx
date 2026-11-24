import Link from 'next/link';
import { btnClass, Card } from '@/components/ui';
import type { Program } from '@/lib/contracts';
import { money } from '@/lib/format';
import { humanMinutes, humanSeconds } from '@/components/register/time';

/** Reglas antifraude vigentes, en palabras de negocio, con acceso directo para cambiarlas. */
export function RulesCard({ program, customerWord }: { program: Program; customerWord: string }) {
  const rules: { k: string; v: string }[] = [
    { k: 'Compra mínima por sello', v: program.requireAmount ? money(program.minSpendCentsPerStamp) : 'No depende del monto' },
    { k: 'Sellos por código sin PIN', v: 'Hasta ' + program.maxSeatsWithoutApproval + '; más pide PIN de dueño o gerente' },
    { k: 'El código vence en', v: humanSeconds(program.codeTtlSeconds) },
    { k: 'Espera entre sellos de un ' + customerWord, v: program.cooldownMinutes > 0 ? humanMinutes(program.cooldownMinutes) : 'Sin espera' }
  ];
  return (
    <Card>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {rules.map((r) => (
          <div key={r.k}>
            <dt className="text-xs font-semibold tracking-wide text-muted">{r.k}</dt>
            <dd className="mt-0.5 text-[15px] font-semibold text-navy">{r.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5"><Link href="/panel/tarjeta" className={btnClass('ghost', 'md')}>Cambiar reglas</Link></div>
    </Card>
  );
}
