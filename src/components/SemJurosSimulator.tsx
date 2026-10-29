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
  PARCELA_MINIMA_CENTS,
  type OpcaoParcela,
  type ResultadoSemJuros,
} from '@/lib/sem-juros';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowRight, Check, Info } from 'lucide-react';

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

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? 'font-semibold' : 'text-sm text-muted-foreground'}>{label}</span>
      <span className={strong ? 'text-xl font-bold' : 'text-sm font-medium'}>{value}</span>
    </div>
  );
}

interface SemJurosSimulatorProps {
  /** Layout mais enxuto para uso em modal. */
  compact?: boolean;
  /** Chamado ao clicar em "Continuar" com uma opção escolhida. Sem ele, o resumo é copiado. */
  onSelect?: (resultado: ResultadoSemJuros, opcao: OpcaoParcela | null) => void;
}

export function SemJurosSimulator({ compact = false, onSelect }: SemJurosSimulatorProps) {
  const { toast } = useToast();
  const [dividaInput, setDividaInput] = useState('');
  const [aVistaInput, setAVistaInput] = useState('');
  const [combinarPix, setCombinarPix] = useState(false);
  const [pixInput, setPixInput] = useState('');
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<number | null>(null);
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

  const onDivida = useCallback((v: string) => { setDividaInput(v); setParcelasSelecionadas(null); }, []);
  const onAVista = useCallback((v: string) => { setAVistaInput(v); setParcelasSelecionadas(null); }, []);
  const onPix = useCallback((v: string) => { setPixInput(v); setParcelasSelecionadas(null); }, []);
  const onCombinar = useCallback((v: boolean) => { setCombinarPix(v); setParcelasSelecionadas(null); }, []);

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
          <h3 className="font-semibold">Configure seu pagamento</h3>
          <p className="text-sm text-muted-foreground">Informe os valores e escolha como deseja realizar o pagamento.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyField id="sj-divida" label="Valor da dívida (R$)" value={dividaInput} onChange={onDivida} />
          <CurrencyField id="sj-avista" label="Valor à vista – boleto (R$)" value={aVistaInput} onChange={onAVista} />
        </div>
        {resultado.valido && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Diferença entre dívida e boleto: {formatCents(resultado.descontoCents)}
          </p>
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
            />
          )}
        </section>
      )}

      {resultado.valido && resultado.elegivel && (
        <section className={`${pad} space-y-4`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold">Parcelamento no cartão</h3>
              <p className="text-sm text-muted-foreground">
                {pixCobreTudo ? 'O PIX cobre todo o valor. Não há parcela no cartão.' : 'Selecione em quantas vezes deseja pagar.'}
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
                      className={`rounded-lg border px-3 py-3 text-center transition-colors ${
                        ativa
                          ? 'border-green-600 bg-green-50 ring-1 ring-green-600'
                          : 'border-border hover:border-green-400 hover:bg-accent'
                      }`}
                    >
                      <p className="font-semibold">{opcao.parcelas === 1 ? 'À vista' : `${opcao.parcelas}x`}</p>
                      <p className="text-xs text-muted-foreground">{formatCents(opcao.valorParcelaCents)}</p>
                    </button>
                  );
                })}
              </div>
              {resultado.opcoes.length < resultado.parcelasMaximas && (
                <p className="text-xs text-muted-foreground">
                  Acima de {resultado.opcoes.length}x a parcela ficaria abaixo do mínimo de {formatCents(PARCELA_MINIMA_CENTS)}.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* ── 4. Resumo ── */}
      {resultado.valido && resultado.elegivel && (
        <section className={`${pad} space-y-4`}>
          <h3 className="font-semibold">Resumo do pagamento</h3>
          <div className="space-y-2.5">
            <SummaryRow label="Valor original da dívida" value={formatCents(resultado.dividaCents)} />
            <SummaryRow label="Valor à vista (boleto)" value={formatCents(resultado.aVistaCents)} />
            <Separator />
            <SummaryRow label="Pagamento PIX" value={formatCents(resultado.pixCents)} />
            <SummaryRow
              label="Pagamento cartão"
              value={opcaoSelecionada ? formatCents(opcaoSelecionada.totalCents) : formatCents(resultado.cartaoCents)}
            />
            <Separator />
            <SummaryRow label="Total do cliente" value={formatCents(resultado.totalClienteCents)} strong />
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

          <Button className="w-full h-11" size="lg" disabled={!podeContinuar} onClick={continuar}>
            {copied ? 'Resumo copiado' : 'Continuar'}
            {copied ? <Check className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </section>
      )}
    </Card>
  );
}
