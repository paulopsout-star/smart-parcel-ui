import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { formatCents, toCents } from '@/lib/currency-utils';
import { AlertTriangle, FlaskConical, Loader2 } from 'lucide-react';

/**
 * Bancada de teste da integração Quita+ "sem juros" (somente admin).
 *
 * Faz um pagamento REAL de valor baixo, passo a passo, pela função isolada
 * `quitaplus-semjuros-test`, que usa SOMENTE a credencial nova e o lojista sem juros
 * (a página não escolhe credencial nem lojista). Não cria cobrança, link nem split: nada do fluxo
 * de produção é tocado. O cartão é digitado aqui e vai direto para a função;
 * não é salvo no navegador nem aparece no registro da página.
 */

const FN = 'quitaplus-semjuros-test';
const MAX_CENTS = 5000;

interface LogEntry { at: string; action: string; result: unknown }
/** Resposta de { action: 'status' } da função isolada. */
interface BenchStatus { lojista?: string; pronto?: boolean; problema?: string | null }

const onlyDigits = (v: string) => v.replace(/\D/g, '');

function Field({ id, label, value, onChange, placeholder, type = 'text', inputMode }: {
  id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; inputMode?: 'numeric' | 'text' | 'email' | 'tel';
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} inputMode={inputMode} value={value} placeholder={placeholder}
        autoComplete="off" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function SemJurosTest() {
  const [amountInput, setAmountInput] = useState('20,00');
  const [installments, setInstallments] = useState('1');

  const [payer, setPayer] = useState({ name: '', document: '', email: '', phoneNumber: '' });
  const [card, setCard] = useState({ holderName: '', number: '', expirationDate: '', cvv: '' });
  const [confirmCharge, setConfirmCharge] = useState(false);

  const [prePaymentKey, setPrePaymentKey] = useState('');
  const [codigoSolicitacao, setCodigoSolicitacao] = useState('');
  const [linhaDigitavel, setLinhaDigitavel] = useState('');

  const [busy, setBusy] = useState<string | null>(null);
  const [bench, setBench] = useState<BenchStatus | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  // A função é isolada na credencial nova: aqui só se confere se ela está pronta para uso
  useEffect(() => {
    supabase.functions.invoke(FN, { body: { action: 'status' } })
      .then(({ data, error }) => setBench(error ? { pronto: false, problema: error.message } : (data as BenchStatus)))
      .catch((e) => setBench({ pronto: false, problema: String(e?.message ?? e) }));
  }, []);
  const benchReady = bench?.pronto === true;

  const amountCents = toCents(amountInput);
  const amountOk = amountCents >= 100 && amountCents <= MAX_CENTS;

  const call = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const { data, error } = await supabase.functions.invoke(FN, {
        body: { action, ...extra },
      });
      const result = error ? { ok: false, error: error.message } : data;
      setLog((prev) => [{ at: new Date().toLocaleTimeString('pt-BR'), action, result }, ...prev]);
      return result as Record<string, unknown>;
    } finally {
      setBusy(null);
    }
  };

  const simulate = () => call('simulate', { amounts: [amountCents] });

  const authorize = async () => {
    const r = await call('pay_authorize', {
      amountInCents: amountCents,
      installments: Number(installments) || 1,
      payer: { ...payer, document: onlyDigits(payer.document), phoneNumber: onlyDigits(payer.phoneNumber) },
      card: { ...card, number: onlyDigits(card.number) },
    });
    if (r?.prePaymentKey) setPrePaymentKey(String(r.prePaymentKey));
    // Depois de enviado, o cartão não fica na tela
    setCard((c) => ({ ...c, number: '', cvv: '' }));
    setConfirmCharge(false);
  };

  const issueBoleto = async () => {
    const r = await call('pay_issue_boleto', {
      amountInCents: amountCents,
      payer: { ...payer, document: onlyDigits(payer.document), phoneNumber: onlyDigits(payer.phoneNumber) },
    });
    if (r?.codigoSolicitacao) setCodigoSolicitacao(String(r.codigoSolicitacao));
    if (r?.linhaDigitavel) setLinhaDigitavel(String(r.linhaDigitavel));
  };

  const boletoStatus = async () => {
    const r = await call('pay_boleto_status', { codigoSolicitacao });
    if (r?.linhaDigitavel) setLinhaDigitavel(String(r.linhaDigitavel));
  };

  const cancelBoleto = () => call('pay_cancel_boleto', { codigoSolicitacao });
  const attach = () => call('pay_attach', { prePaymentKey, linhaDigitavel: onlyDigits(linhaDigitavel) });
  const status = () => call('prepayment_status', { prePaymentKey });

  const Busy = ({ action }: { action: string }) =>
    busy === action ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null;

  const payerOk = payer.name.trim() && [11, 14].includes(onlyDigits(payer.document).length);

  return (
    <DashboardShell>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><FlaskConical className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold">Teste de integração — Quita+ sem juros</h1>
            <p className="text-sm text-muted-foreground">Pagamento real de valor baixo, isolado do fluxo de produção.</p>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Esta página cobra de verdade no cartão informado, até {formatCents(MAX_CENTS)}. Ela não cria cobrança,
            link nem split na plataforma. Execute os passos em ordem e não repita a pré-autorização se ela não
            responder: confira antes a fatura do cartão.
          </AlertDescription>
        </Alert>

        {/* 1. Configuração */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Configuração</CardTitle>
            <CardDescription>Credencial e lojista são fixos na função de teste; esta página não os altera.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Credencial:</span> <Badge variant="secondary">nova (sem juros)</Badge></p>
              <p><span className="text-muted-foreground">Lojista:</span> <span className="font-mono">{bench?.lojista ?? '…'}</span></p>
              <p className="text-xs text-muted-foreground">
                A credencial atual (com juros) não é usada nesta página em nenhuma chamada.
              </p>
            </div>
            {bench && !benchReady && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{bench.problema || 'A função de teste não está pronta.'}</AlertDescription>
              </Alert>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="t-amount" label={`Valor (máx. ${formatCents(MAX_CENTS)})`} value={amountInput} onChange={setAmountInput} inputMode="numeric" />
              <Field id="t-inst" label="Parcelas (1 a 12)" value={installments} onChange={(v) => setInstallments(onlyDigits(v).slice(0, 2))} inputMode="numeric" />
            </div>
            {!amountOk && <p className="text-sm text-destructive">Informe um valor entre R$ 1,00 e {formatCents(MAX_CENTS)}.</p>}
            <Button type="button" variant="outline" disabled={!amountOk || !!busy || !benchReady} onClick={simulate}>
              <Busy action="simulate" />Simular {formatCents(amountCents)}
            </Button>
          </CardContent>
        </Card>

        {/* 2. Pré-autorização */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Pré-autorização no cartão</CardTitle>
            <CardDescription>Pagador e cartão do teste. O número e o CVV saem da tela depois do envio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="t-pname" label="Nome do pagador" value={payer.name} onChange={(v) => setPayer({ ...payer, name: v })} />
              <Field id="t-pdoc" label="CPF/CNPJ do pagador" value={payer.document} onChange={(v) => setPayer({ ...payer, document: v })} inputMode="numeric" />
              <Field id="t-pemail" label="E-mail" value={payer.email} onChange={(v) => setPayer({ ...payer, email: v })} type="email" inputMode="email" />
              <Field id="t-pphone" label="Telefone com DDD" value={payer.phoneNumber} onChange={(v) => setPayer({ ...payer, phoneNumber: v })} inputMode="tel" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field id="t-cname" label="Nome impresso no cartão" value={card.holderName} onChange={(v) => setCard({ ...card, holderName: v })} />
              <Field id="t-cnum" label="Número do cartão" value={card.number} onChange={(v) => setCard({ ...card, number: v })} inputMode="numeric" />
              <Field id="t-cexp" label="Validade (MM/AA)" value={card.expirationDate} onChange={(v) => setCard({ ...card, expirationDate: v })} placeholder="MM/AA" inputMode="numeric" />
              <Field id="t-ccvv" label="CVV" value={card.cvv} onChange={(v) => setCard({ ...card, cvv: onlyDigits(v).slice(0, 4) })} type="password" inputMode="numeric" />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox id="t-confirm" checked={confirmCharge} onCheckedChange={(v) => setConfirmCharge(v === true)} />
              <Label htmlFor="t-confirm" className="text-sm font-normal leading-snug cursor-pointer">
                Entendo que isto cobra {formatCents(amountCents)} de verdade neste cartão, em {installments || 1}x,
                no lojista {bench?.lojista ?? 'sem juros'}, com a credencial nova.
              </Label>
            </div>
            <Button type="button" disabled={!amountOk || !confirmCharge || !!busy || !!prePaymentKey || !benchReady} onClick={authorize}>
              <Busy action="pay_authorize" />Pré-autorizar {formatCents(amountCents)}
            </Button>
            {prePaymentKey && (
              <p className="text-sm">
                <Badge variant="secondary" className="mr-2">prePaymentKey</Badge>
                <span className="font-mono">{prePaymentKey}</span>
              </p>
            )}
            <Field id="t-key" label="prePaymentKey (preenchido após a pré-autorização)" value={prePaymentKey} onChange={setPrePaymentKey} />
          </CardContent>
        </Card>

        {/* 3. Boleto */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Boleto do Inter no mesmo valor</CardTitle>
            <CardDescription>
              Emite um boleto de {formatCents(amountCents)} em nome do pagador acima. Se o Inter demorar, use "Consultar boleto".
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={!amountOk || !payerOk || !!busy || !!codigoSolicitacao} onClick={issueBoleto}>
                <Busy action="pay_issue_boleto" />Emitir boleto
              </Button>
              <Button type="button" variant="outline" disabled={!codigoSolicitacao || !!busy} onClick={boletoStatus}>
                <Busy action="pay_boleto_status" />Consultar boleto
              </Button>
              <Button type="button" variant="ghost" disabled={!codigoSolicitacao || !!busy} onClick={cancelBoleto}>
                <Busy action="pay_cancel_boleto" />Cancelar boleto
              </Button>
            </div>
            <Field id="t-cod" label="Código da solicitação no Inter" value={codigoSolicitacao} onChange={setCodigoSolicitacao} />
            <Field id="t-linha" label="Linha digitável (preenchida pela emissão, ou cole uma)" value={linhaDigitavel} onChange={setLinhaDigitavel} inputMode="numeric" />
          </CardContent>
        </Card>

        {/* 4. Vínculo e status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">4. Vínculo e acompanhamento</CardTitle>
            <CardDescription>Vincula o boleto à pré-autorização e consulta o status no Quita+.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" disabled={!prePaymentKey || ![47, 48].includes(onlyDigits(linhaDigitavel).length) || !!busy || !benchReady} onClick={attach}>
              <Busy action="pay_attach" />Vincular boleto
            </Button>
            <Button type="button" variant="outline" disabled={!prePaymentKey || !!busy || !benchReady} onClick={status}>
              <Busy action="prepayment_status" />Consultar status
            </Button>
          </CardContent>
        </Card>

        {/* Registro */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Registro das chamadas</CardTitle>
            <CardDescription>Respostas da função de teste, da mais recente para a mais antiga. Não contém dados do cartão.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {log.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chamada ainda.</p>}
            {log.map((entry, i) => (
              <div key={`${entry.at}-${i}`} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">{entry.at} · <span className="font-medium text-foreground">{entry.action}</span></p>
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-all">{JSON.stringify(entry.result, null, 2)}</pre>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
