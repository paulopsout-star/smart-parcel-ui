import { Badge } from '@/components/ui/badge';
import { parseBoleto, boletoDueInfo, formatIsoDateBR, type BoletoInfo, type BoletoDueInfo } from '@/lib/boleto';

import { formatCurrency } from '@/lib/utils';

/** Texto curto da situação de vencimento, ex.: "Vencido há 3 dias (17/10/2026)". */
export function dueLabel(due: BoletoDueInfo): string {
  if (due.status === 'no_due') return 'Sem vencimento';
  const date = formatIsoDateBR(due.dueDate);
  if (due.status === 'due_today') return `Vence hoje (${date})`;
  if (due.status === 'expired') {
    const n = Math.abs(due.days ?? 0);
    return `Vencido há ${n} ${n === 1 ? 'dia' : 'dias'} (${date})`;
  }
  const n = due.days ?? 0;
  return `Vence em ${n} ${n === 1 ? 'dia' : 'dias'} (${date})`;
}

interface Props {
  linha: string | null | undefined;
  /** Valor esperado (cartão autorizado) para comparar com o valor do boleto */
  expectedCents?: number | null;
  className?: string;
}

/**
 * Validade OFFLINE de uma linha digitável: dígitos verificadores, vencimento, valor e banco.
 * Não sabe se o boleto já foi pago ou baixado — isso só o banco emissor informa.
 */
export function BoletoValidity({ linha, expectedCents, className }: Props) {
  if (!linha) return null;
  const info: BoletoInfo = parseBoleto(linha);
  const due = boletoDueInfo(info);
  const mismatch = info.valueCents !== null && !!expectedCents && info.valueCents !== expectedCents;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-xs ${className ?? ''}`}>
      {info.kind === 'invalid' ? (
        <Badge variant="destructive" title={info.problems.join(', ')}>
          ✕ Linha inválida · {info.problems.join(', ')}
        </Badge>
      ) : due.status === 'expired' ? (
        <Badge variant="destructive">⏱ {dueLabel(due)}</Badge>
      ) : due.status === 'due_today' ? (
        <Badge variant="warning">⏱ {dueLabel(due)}</Badge>
      ) : due.status === 'ok' ? (
        <Badge variant="success">✓ Válido · {dueLabel(due)}</Badge>
      ) : (
        <Badge variant="secondary">✓ DVs conferem · {dueLabel(due)}</Badge>
      )}
      {info.valueCents !== null && (
        <span className={mismatch ? 'text-amber-700 dark:text-amber-300 font-medium' : 'text-ds-text-muted'}>
          {formatCurrency(info.valueCents)}
          {mismatch ? ` ≠ cartão ${formatCurrency(expectedCents as number)}` : ''}
        </span>
      )}
      {info.bankCode && (
        <span className="text-ds-text-muted">· {info.bankName ?? `Banco ${info.bankCode}`}</span>
      )}
    </div>
  );
}
