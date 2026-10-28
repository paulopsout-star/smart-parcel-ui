import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { AlertCircle, BadgePercent, Check, Copy, CreditCard, Info, QrCode } from 'lucide-react';

function parseCurrencyInput(value: string): string {
  const raw = value.replace(/\D/g, '');
  if (!raw) return '';
  const cents = parseInt(raw);
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CurrencyInput({
  id, label, value, onChange, hint,
}: { id: string; label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">R$</span>
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
          placeholder="0,00"
          className="pl-10 text-right font-medium"
        />
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface SemJurosSimulatorProps {
  /** Layout mais enxuto para uso em modal. */
  compact?: boolean;
  onSelect?: (resultado: ResultadoSemJuros, opcao: OpcaoParcela) => void;
}

export function SemJurosSimulator({ compact = false, onSelect }: SemJurosSimulatorProps) {
  const { toast } = useToast();
  const [dividaInput, setDividaInput] = useState('');
  const [aVistaInput, setAVistaInput] = useState('');
  const [pixInput, setPixInput] = useState('');
  const [parcelasSelecionadas, setParcelasSelecionadas] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const resultado = useMemo(
    () => calcularSemJuros({
      dividaCents: toCents(dividaInput),
      aVistaCents: toCents(aVistaInput),
      pixCents: toCents(pixInput),
    }),
    [dividaInput, aVistaInput, pixInput],
  );

  const opcaoSelecionada = resultado.opcoes.find((o) => o.parcelas === parcelasSelecionadas) ?? null;
  const camposPreenchidos = toCents(dividaInput) > 0 && toCents(aVistaInput) > 0;
  const erroVisivel = camposPreenchidos ? resultado.erro : undefined;

  const onDivida = useCallback((v: string) => { setDividaInput(v); setParcelasSelecionadas(null); }, []);
  const onAVista = useCallback((v: string) => { setAVistaInput(v); setParcelasSelecionadas(null); }, []);
  const onPix = useCallback((v: string) => { setPixInput(v); setParcelasSelecionadas(null); }, []);

  const selecionar = useCallback((opcao: OpcaoParcela) => {
    setParcelasSelecionadas(opcao.parcelas);
    onSelect?.(resultado, opcao);
  }, [onSelect, resultado]);

  const copiarResumo = useCallback(() => {
    if (!opcaoSelecionada) return;
    const parcelaTxt = opcaoSelecionada.parcelas === 1
      ? `à vista no cartão ${formatCents(opcaoSelecionada.totalCents)}`
      : `${opcaoSelecionada.parcelas}x de ${formatCents(opcaoSelecionada.valorParcelaCents)} sem juros = ${formatCents(opcaoSelecionada.totalCents)}`;
    const linhas = [
      '💳 Simulação de pagamento sem juros',
      '',
      `Dívida: ${formatCents(resultado.dividaCents)} | À vista: ${formatCents(resultado.aVistaCents)}`,
      resultado.pixCents > 0 ? `PIX: ${formatCents(resultado.pixCents)}` : null,
      `Cartão: ${parcelaTxt}`,
      '',
      `Total a pagar: ${formatCents(resultado.totalClienteCents)}`,
      resultado.abatimentoCents > 0 ? `Economia em relação à dívida: ${formatCents(resultado.abatimentoCents)}` : null,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(linhas).then(() => {
      setCopied(true);
      toast({ title: 'Resumo copiado!', description: 'Cole no WhatsApp ou onde preferir.' });
      setTimeout(() => setCopied(false), 2000);
    });
  }, [opcaoSelecionada, resultado, toast]);

  const cartaoComJurosCents = Math.max(0, resultado.dividaCents - resultado.pixCents);

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* ── Entradas ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgePercent className="h-4 w-4" />
            Desconto do credor
          </CardTitle>
          <CardDescription>
            A diferença entre a dívida e o valor à vista financia o parcelamento sem juros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <CurrencyInput id="sj-divida" label="Valor da dívida" value={dividaInput} onChange={onDivida} />
            <CurrencyInput id="sj-avista" label="Valor à vista (boleto)" value={aVistaInput} onChange={onAVista} />
          </div>
          <CurrencyInput
            id="sj-pix"
            label="Cliente paga no PIX (opcional)"
            value={pixInput}
            onChange={onPix}
            hint="Pagamento combinado: o restante do total vai para o cartão, nas parcelas sem juros."
          />

          {erroVisivel && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{erroVisivel}</AlertDescription>
            </Alert>
          )}

          {resultado.valido && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {resultado.elegivel ? (
                <Badge className="bg-green-600 hover:bg-green-600">Sem juros em até {resultado.parcelasMaximas}x</Badge>
              ) : (
                <Badge variant="outline">Sem opção sem juros para este desconto</Badge>
              )}
              {resultado.abatimentoCents > 0 && (
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Repasse ao cliente: {formatCents(resultado.abatimentoCents)}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Não elegível: fluxo atual com juros ── */}
      {resultado.valido && !resultado.elegivel && (
        <>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Este desconto não habilita parcelamento sem juros. Abaixo, a simulação
              padrão do Quita+ com juros para {formatCents(cartaoComJurosCents)} no cartão
              {resultado.pixCents > 0 ? ` (dívida de ${formatCents(resultado.dividaCents)} menos ${formatCents(resultado.pixCents)} no PIX)` : ''}.
            </AlertDescription>
          </Alert>
          {cartaoComJurosCents > 0 && (
            <PaymentSimulator
              amountCents={cartaoComJurosCents}
              title="Parcelamento com juros (Quita+)"
              subtitle={`Parcele os ${formatCents(cartaoComJurosCents)} do cartão`}
            />
          )}
        </>
      )}

      {/* ── Elegível: totais e opções sem juros ── */}
      {resultado.valido && resultado.elegivel && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground">Total do cliente</p>
              <p className="text-lg font-bold">{formatCents(resultado.totalClienteCents)}</p>
              {resultado.abatimentoCents > 0 && (
                <p className="text-xs text-green-700">dívida {formatCents(resultado.dividaCents)} − {formatCents(resultado.abatimentoCents)}</p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><QrCode className="h-3 w-3" /> PIX</p>
              <p className="text-lg font-bold">{formatCents(resultado.pixCents)}</p>
              <p className="text-xs text-muted-foreground">sem taxa</p>
            </div>
            <div className="p-3 rounded-lg bg-muted">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><CreditCard className="h-3 w-3" /> Cartão</p>
              <p className="text-lg font-bold">{formatCents(resultado.cartaoCents)}</p>
              <p className="text-xs text-muted-foreground">em até {resultado.parcelasMaximas}x sem juros</p>
            </div>
          </div>

          {resultado.cartaoCents > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Parcelamento sem juros</CardTitle>
                <CardDescription>
                  Escolha uma opção para montar o resumo. Parcela mínima de {formatCents(PARCELA_MINIMA_CENTS)}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {resultado.opcoes.map((opcao) => {
                    const ativa = opcao.parcelas === parcelasSelecionadas;
                    return (
                      <button
                        key={opcao.parcelas}
                        type="button"
                        onClick={() => selecionar(opcao)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          ativa ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50 hover:bg-accent'
                        }`}
                      >
                        <p className="font-semibold">
                          {opcao.parcelas === 1 ? 'À vista' : `${opcao.parcelas}x de ${formatCents(opcao.valorParcelaCents)}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {opcao.parcelas === 1 ? formatCents(opcao.totalCents) : `total ${formatCents(opcao.totalCents)} · sem juros`}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {resultado.opcoes.length < resultado.parcelasMaximas && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Opções acima de {resultado.opcoes.length}x ficariam abaixo da parcela mínima de {formatCents(PARCELA_MINIMA_CENTS)}.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>O PIX cobre todo o valor a pagar. Não há parcela no cartão.</AlertDescription>
            </Alert>
          )}

          {/* ── Resumo ── */}
          {(opcaoSelecionada || resultado.cartaoCents === 0) && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Resumo do Pagamento</CardTitle>
                  {opcaoSelecionada && (
                    <Button variant="outline" size="sm" onClick={copiarResumo} className="h-8 gap-1.5">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copiado!' : 'Copiar'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {resultado.pixCents > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm"><QrCode className="h-4 w-4 text-blue-500" /> PIX</span>
                    <span className="font-semibold">{formatCents(resultado.pixCents)}</span>
                  </div>
                )}
                {opcaoSelecionada && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <CreditCard className="h-4 w-4 text-violet-500" />
                      {opcaoSelecionada.parcelas === 1
                        ? 'Cartão à vista'
                        : `Cartão ${opcaoSelecionada.parcelas}x de ${formatCents(opcaoSelecionada.valorParcelaCents)}`}
                      <span className="text-xs text-green-600 font-medium">sem juros</span>
                    </span>
                    <span className="font-semibold">{formatCents(opcaoSelecionada.totalCents)}</span>
                  </div>
                )}
                {opcaoSelecionada && opcaoSelecionada.ultimaParcelaCents !== opcaoSelecionada.valorParcelaCents && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Última parcela de {formatCents(opcaoSelecionada.ultimaParcelaCents)} (ajuste de centavos).
                  </p>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Total a pagar</span>
                  <span className="text-lg font-bold text-primary">{formatCents(resultado.totalClienteCents)}</span>
                </div>
                {resultado.abatimentoCents > 0 && (
                  <p className="text-xs text-center text-green-700">
                    O cliente economiza {formatCents(resultado.abatimentoCents)} em relação à dívida de {formatCents(resultado.dividaCents)}.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
