import { useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { PaymentSimulator } from '@/components/PaymentSimulator';
import { formatCents, toCents } from '@/lib/currency-utils';
import {
  calcularSemJuros,
  DESCONTO_MAXIMO_RETIDO,
  PARCELA_MINIMA_CENTS,
  type OpcaoParcela,
  type ResultadoSemJuros,
} from '@/lib/sem-juros';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowRight, Check, CreditCard, Info, Tag } from 'lucide-react';
import { formatarPct } from '@/lib/sem-juros';

function parseCurrencyInput(value: string): string {
  const raw = value.replace(/\D/g, '');
  if (!raw) return '';
  const cents = parseInt(raw);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CurrencyField({
  id, label, value, onChange,
}: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
        placeholder="0,00"
        className="h-11 text-right font-medium"
      />
    </div>
  );
}

function SummaryRow({ label, value, strong = false, highlight = false }: { label: string; value: string; strong?: boolean; highlight?: boolean }) {
  if (highlight) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <span className="text-sm font-semibold flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />{label}</span>
        <span className="text-sm font-bold whitespace-nowrap">{value}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</span>
      <span className={strong ? 'text-2xl font-bold whitespace-nowrap' : 'text-sm font-medium whitespace-nowrap'}>{value}</span>
    </div>
  );
}

/**
 * Cenário A (desconto negociado até 35%): o cliente paga a dívida integral; o benefício é o parcelamento
 * sem juros. Nada de desconto, diferença ou economia aqui.
 */
function CondicaoCard({ resultado, opcao }: { resultado: ResultadoSemJuros; opcao: OpcaoParcela | null }) {
  const pixCobreTudo = resultado.cartaoCents === 0;
  const maior = resultado.opcoes.length ? resultado.opcoes[resultado.opcoes.length - 1] : null;
  const destaque = opcao ?? maior;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-emerald-600 p-1.5 text-white"><CreditCard className="h-4 w-4" /></div>
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Condição para o cliente</p>
            <p className="text-lg font-bold leading-tight text-slate-900 dark:text-slate-100">
              {pixCobreTudo ? 'Pagamento integral via PIX' : `Pagamento em até ${resultado.parcelasMaximas}x sem juros`}
            </p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
              {pixCobreTudo
                ? `O cliente quita a dívida de ${formatCents(resultado.dividaCents)} via PIX, sem custo adicional.`
                : `O cliente quita a dívida de ${formatCents(resultado.dividaCents)} em até ${resultado.parcelasMaximas} parcelas, sem pagar nada além do valor original.`}
            </p>
          </div>
        </div>
        {!pixCobreTudo && destaque && (
          <div className="text-right sm:min-w-[140px]">
            <p className="text-[11px] text-muted-foreground">
              {opcao ? (opcao.parcelas === 1 ? 'À vista no cartão' : `Parcela em ${opcao.parcelas}x`) : `Parcele em até ${destaque.parcelas}x`}
            </p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
              {formatCents(destaque.parcelas === 1 ? destaque.totalCents : destaque.valorParcelaCents)}
            </p>
            <p className="text-[11px] text-muted-foreground whitespace-nowrap">Total da cobrança: {formatCents(resultado.totalClienteCents)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Economia efetiva do cliente = dívida − total do cliente. Zero quando paga a dívida integral; negativa = acréscimo. */
function EconomiaCard({ dividaCents, totalClienteCents }: { dividaCents: number; totalClienteCents: number }) {
  const economia = dividaCents - totalClienteCents;
  const pct = dividaCents > 0 ? Math.abs(economia) / dividaCents : 0;
  const acrescimo = economia < 0;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-emerald-600 p-1.5 text-white"><Tag className="h-4 w-4" /></div>
          <div>
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {acrescimo ? 'Acréscimo sobre a dívida' : economia > 0 ? 'Desconto para o cliente' : 'Sem economia efetiva'}
            </p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 leading-tight">
              {formatCents(Math.abs(economia))}
              <span className="ml-2 align-middle text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatarPct(pct, 0)} {acrescimo ? 'de acréscimo' : 'de desconto'}
              </span>
            </p>
            {economia === 0 && (
              <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">O cliente paga a dívida integral, parcelada sem juros.</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm sm:justify-end">
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Valor original da dívida</p>
            <p className="font-medium whitespace-nowrap">{formatCents(dividaCents)}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Valor do cliente</p>
            <p className="font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{formatCents(totalClienteCents)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface SemJurosSimulatorProps {
  /** Layout mais enxuto para uso em modal. */
  compact?: boolean;
  /** Chamado ao clicar em "Continuar" com uma opção escolhida. Sem ele, o resumo é copiado. */
  onSelect?: (resultado: ResultadoSemJuros, opcao: OpcaoParcela | null) => void;
  /**
   * Desconto abaixo de 20%: a cobrança segue COM juros (Quita+). Quando informado, aparece
   * "Continuar com juros" levando dívida, à vista, PIX e a parcela escolhida na simulação do Quita+.
   */
  onSelectComJuros?: (resultado: ResultadoSemJuros, parcelasSelecionadas: number | null) => void;
}

export function SemJurosSimulator({ compact = false, onSelect, onSelectComJuros }: SemJurosSimulatorProps) {
  const { toast } = useToast();
  const [dividaInput, setDividaInput] = useState('');
  const [aVistaInput, setAVistaInput] = useState('');
  const [combinarPix, setCombinarPix] = useState(false);
  const [pixInput, setPixInput] = useState('');
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<number | null>(null);
  const [parcelasComJuros, setParcelasComJuros] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const resultado = useMemo(
    () => calcularSemJuros({
      dividaCents: toCents(dividaInput),
      aVistaCents: toCents(aVistaInput),
      pixCents: combinarPix ? toCents(pixInput) : 0,
    }),
    [dividaInput, aVistaInput, pixInput, combinarPix],
  );

  const camposPreenchidos = toCents(dividaInput) > 0 && toCents(aVistaInput) > 0;
  const erroVisivel = camposPreenchidos ? resultado.erro : undefined;
  const opcaoSelecionada = resultado.opcoes.find((o) => o.parcelas === parcelasSelecionadas) ?? null;
  const pixCobreTudo = resultado.valido && resultado.elegivel && resultado.cartaoCents === 0;
  const podeContinuar = resultado.valido && resultado.elegivel && (!!opcaoSelecionada || pixCobreTudo);
  // Acima do desconto máximo retido (35%) a regra de repasse devolve parte ao cliente: muda só a apresentação
  const repasseAoCliente = resultado.descontoPct > DESCONTO_MAXIMO_RETIDO + 1e-9;

  const onDivida = useCallback((v: string) => { setDividaInput(v); setParcelasSelecionadas(null); setParcelasComJuros(null); }, []);
  const onAVista = useCallback((v: string) => { setAVistaInput(v); setParcelasSelecionadas(null); setParcelasComJuros(null); }, []);
  const onPix = useCallback((v: string) => { setPixInput(v); setParcelasSelecionadas(null); setParcelasComJuros(null); }, []);
  const onCombinar = useCallback((v: boolean) => { setCombinarPix(v); setParcelasSelecionadas(null); setParcelasComJuros(null); }, []);

  const textoResumo = useCallback(() => {
    const cartao = opcaoSelecionada
      ? (opcaoSelecionada.parcelas === 1
        ? `Cartão à vista: ${formatCents(opcaoSelecionada.totalCents)}`
        : `Cartão: ${opcaoSelecionada.parcelas}x de ${formatCents(opcaoSelecionada.valorParcelaCents)} sem juros = ${formatCents(opcaoSelecionada.totalCents)}`)
      : null;
    return [
      '💳 Simulação de pagamento sem juros',
      '',
      `Valor original da dívida: ${formatCents(resultado.dividaCents)}`,
      `Valor à vista (boleto): ${formatCents(resultado.aVistaCents)}`,
      '',
      resultado.pixCents > 0 ? `PIX: ${formatCents(resultado.pixCents)}` : null,
      cartao,
      '',
      `Total do cliente: ${formatCents(resultado.totalClienteCents)}`,
    ].filter((l) => l !== null).join('\n');
  }, [opcaoSelecionada, resultado]);

  const continuar = useCallback(() => {
    if (!podeContinuar) return;
    if (onSelect) {
      onSelect(resultado, opcaoSelecionada);
      return;
    }
    navigator.clipboard.writeText(textoResumo()).then(() => {
      setCopied(true);
      toast({ title: 'Resumo copiado!', description: 'Cole no WhatsApp ou onde preferir.' });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [podeContinuar, onSelect, resultado, opcaoSelecionada, textoResumo, toast]);

  const cartaoComJurosCents = Math.max(0, resultado.dividaCents - resultado.pixCents);
  const pad = compact ? 'p-4' : 'p-5';

  return (
    <Card className="divide-y">
      {/* ── 1. Valores ── */}
      <section className={`${pad} space-y-4`}>
        <div>
          <h3 className="font-semibold">Simular cobrança</h3>
          <p className="text-sm text-muted-foreground">Preencha os valores, defina a forma de pagamento e confira as condições para o cliente.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyField id="sj-divida" label="Valor da dívida (R$)" value={dividaInput} onChange={onDivida} />
          <CurrencyField id="sj-avista" label="Valor negociado – boleto (R$)" value={aVistaInput} onChange={onAVista} />
        </div>
        {/* Cenário A (até 35%): condição de parcelamento, sem valores de desconto. Cenário B (> 35%): economia efetiva pela regra de repasse. */}
        {resultado.valido && resultado.elegivel && !repasseAoCliente && (
          <CondicaoCard resultado={resultado} opcao={opcaoSelecionada} />
        )}
        {resultado.valido && resultado.elegivel && repasseAoCliente && (
          <EconomiaCard dividaCents={resultado.dividaCents} totalClienteCents={resultado.totalClienteCents} />
        )}
        {erroVisivel && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{erroVisivel}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* ── 2. Combinar PIX + cartão ── */}
      <section className={`${pad} space-y-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">Combinar PIX + cartão</h3>
            <p className="text-sm text-muted-foreground">Deseja pagar uma parte via PIX?</p>
          </div>
          <Switch
            checked={combinarPix}
            onCheckedChange={onCombinar}
            aria-label="Combinar PIX e cartão"
            className="data-[state=checked]:bg-green-600"
          />
        </div>
        {combinarPix && (
          <div className="space-y-2">
            <CurrencyField id="sj-pix" label="Valor PIX (R$)" value={pixInput} onChange={onPix} />
            {resultado.valido && (
              <p className="text-xs text-muted-foreground">
                O valor restante será distribuído ao cartão: <span className="font-medium text-foreground">{formatCents(resultado.cartaoCents)}</span>
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── 3. Parcelamento ── */}
      {resultado.valido && !resultado.elegivel && (
        <section className={`${pad} space-y-4`}>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este desconto não habilita parcelamento sem juros. Abaixo, a simulação padrão do Quita+ com juros
              para {formatCents(cartaoComJurosCents)} no cartão.
            </AlertDescription>
          </Alert>
          {cartaoComJurosCents > 0 && (
            <PaymentSimulator
              amountCents={cartaoComJurosCents}
              title="Parcelamento com juros (Quita+)"
              subtitle={`Parcele os ${formatCents(cartaoComJurosCents)} do cartão`}
              onSelectInstallment={onSelectComJuros ? (n) => setParcelasComJuros(n) : undefined}
              selectedInstallments={parcelasComJuros ?? undefined}
            />
          )}
          {onSelectComJuros && (
            <Button
              className="w-full h-11"
              size="lg"
              variant="secondary"
              disabled={cartaoComJurosCents > 0 && !parcelasComJuros}
              onClick={() => onSelectComJuros(resultado, cartaoComJurosCents > 0 ? parcelasComJuros : null)}
            >
              Continuar com juros
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </section>
      )}

      {resultado.valido && resultado.elegivel && (
        <section className={`${pad} space-y-4`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Pagamento no cartão</h3>
              <p className="text-sm text-muted-foreground">
                {pixCobreTudo ? 'O PIX cobre todo o valor. Não há parcela no cartão.' : 'Escolha em quantas vezes o cliente poderá pagar.'}
              </p>
            </div>
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 whitespace-nowrap">
              Até {resultado.parcelasMaximas}x sem juros
            </Badge>
          </div>

          {!pixCobreTudo && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {resultado.opcoes.map((opcao) => {
                  const ativa = opcao.parcelas === parcelasSelecionadas;
                  return (
                    <button
                      key={opcao.parcelas}
                      type="button"
                      onClick={() => setParcelasSelecionadas(opcao.parcelas)}
                      aria-pressed={ativa}
                      className={`relative rounded-lg border px-3 py-3 text-left transition-colors ${
                        ativa
                          ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600 dark:bg-emerald-950/30'
                          : 'border-border hover:border-emerald-400 hover:bg-accent'
                      }`}
                    >
                      <span className={`absolute right-2.5 top-2.5 h-3.5 w-3.5 rounded-full border-2 ${ativa ? 'border-emerald-600 bg-emerald-600' : 'border-muted-foreground/40'}`} aria-hidden />
                      <p className="font-semibold">{opcao.parcelas === 1 ? 'À vista' : `${opcao.parcelas}x`}</p>
                      <p className="text-xs text-muted-foreground">{formatCents(opcao.valorParcelaCents)}</p>
                    </button>
                  );
                })}
              </div>
              {resultado.opcoes.length < resultado.parcelasMaximas && (
                <p className="text-xs text-muted-foreground">
                  O valor mínimo da parcela é de {formatCents(PARCELA_MINIMA_CENTS)}: acima de {resultado.opcoes.length}x ela ficaria abaixo disso.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── 4. Resumo ── */}
      {resultado.valido && resultado.elegivel && (
        <section className={`${pad} space-y-4`}>
          <h3 className="font-semibold">Resumo da simulação</h3>
          <div className="space-y-2.5">
            <SummaryRow label="Valor original da dívida" value={formatCents(resultado.dividaCents)} />
            <SummaryRow label="Valor negociado (boleto)" value={formatCents(resultado.aVistaCents)} />
            <Separator />
            {resultado.pixCents > 0 && <SummaryRow label="Pagamento via PIX" value={formatCents(resultado.pixCents)} />}
            {resultado.cartaoCents > 0 && (
              <SummaryRow
                label={opcaoSelecionada ? `Pagamento no cartão (${opcaoSelecionada.parcelas === 1 ? 'à vista' : `${opcaoSelecionada.parcelas}x`})` : 'Pagamento no cartão'}
                value={opcaoSelecionada ? formatCents(opcaoSelecionada.totalCents) : formatCents(resultado.cartaoCents)}
              />
            )}
            {repasseAoCliente && (
              <SummaryRow
                highlight
                label={resultado.abatimentoCents < 0 ? 'Acréscimo sobre a dívida' : 'Desconto efetivo para o cliente'}
                value={`${formatCents(Math.abs(resultado.abatimentoCents))} (${formatarPct(resultado.dividaCents > 0 ? Math.abs(resultado.abatimentoCents) / resultado.dividaCents : 0, 0)})`}
              />
            )}
            <Separator />
            <SummaryRow label="Total da cobrança" value={formatCents(resultado.totalClienteCents)} strong />
          </div>

          {opcaoSelecionada && (
            <p className="flex items-center gap-1.5 text-sm text-green-700">
              <Check className="h-4 w-4" />
              {opcaoSelecionada.parcelas === 1
                ? 'À vista no cartão, sem juros'
                : `${opcaoSelecionada.parcelas}x de ${formatCents(opcaoSelecionada.valorParcelaCents)} no cartão, sem juros`}
              {opcaoSelecionada.ultimaParcelaCents !== opcaoSelecionada.valorParcelaCents &&
                ` (última de ${formatCents(opcaoSelecionada.ultimaParcelaCents)})`}
            </p>
          )}
          {pixCobreTudo && (
            <p className="flex items-center gap-1.5 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Pagamento integral via PIX
            </p>
          )}

          <Button className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold" size="lg" disabled={!podeContinuar} onClick={continuar}>
            {copied ? 'Resumo copiado' : 'Continuar'}
            {copied ? <Check className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </section>
      )}
    </Card>
  );
}
