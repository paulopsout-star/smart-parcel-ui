import { Badge } from '@/components/ui/badge';
import { formatCents } from '@/lib/currency-utils';
import { formatarPct } from '@/lib/sem-juros';
import type { SemJurosMetadata } from './index';

/** Selo curto para listas e cabeçalhos. */
export function SemJurosBadge({ className = '' }: { className?: string }) {
  return (
    <Badge variant="outline" className={`border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ${className}`}>
      Sem juros
    </Badge>
  );
}

/**
 * Linhas que só o administrador vê no detalhe da cobrança: a "taxa" desta modalidade é o
 * desconto que a operação retém do credor, conforme a tabela de faixas.
 */
export function SemJurosResumoAdmin({ dados, parcelas }: { dados: SemJurosMetadata; parcelas?: number | null }) {
  const retido = dados.desconto_retido_cents ?? (dados.total_cliente_cents - dados.a_vista_cents);
  const pctDivida = dados.divida_cents > 0 ? retido / dados.divida_cents : 0;
  const pctAVista = dados.a_vista_cents > 0 ? retido / dados.a_vista_cents : 0;
  const n = parcelas ?? dados.parcelas_selecionadas ?? null;

  return (
    <div className="space-y-1.5 text-sm rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-emerald-800 dark:text-emerald-200">
          Sem juros{n && n > 1 ? ` (${n}x)` : ''} · até {dados.parcelas_maximas}x
        </span>
        <SemJurosBadge />
      </div>
      <div className="flex justify-between text-ds-text-muted">
        <span>Dívida original:</span><span>{formatCents(dados.divida_cents)}</span>
      </div>
      <div className="flex justify-between text-ds-text-muted">
        <span>Boleto do credor (à vista):</span><span>{formatCents(dados.a_vista_cents)}</span>
      </div>
      <div className="flex justify-between text-ds-text-muted">
        <span>Desconto do credor:</span>
        <span>{formatCents(dados.desconto_cents)} ({formatarPct(dados.desconto_pct ?? (dados.divida_cents ? dados.desconto_cents / dados.divida_cents : 0))})</span>
      </div>
      <div className="flex justify-between text-emerald-700 dark:text-emerald-300 font-medium">
        <span>Retido pela operação:</span>
        <span>{formatCents(retido)} ({formatarPct(pctDivida)} da dívida · {formatarPct(pctAVista)} sobre o à vista)</span>
      </div>
      {dados.abatimento_cents > 0 && (
        <div className="flex justify-between text-ds-text-muted">
          <span>Repassado ao cliente:</span><span>{formatCents(dados.abatimento_cents)}</span>
        </div>
      )}
      <div className="flex justify-between border-t border-emerald-500/20 pt-1.5 mt-1.5">
        <span>Total do cliente{dados.pix_cents > 0 ? ' (PIX + cartão)' : ''}:</span>
        <span className="font-semibold">{formatCents(dados.total_cliente_cents)}</span>
      </div>
    </div>
  );
}
