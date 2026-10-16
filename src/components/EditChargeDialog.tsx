import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { getFunctionErrorMessage } from '@/lib/functionError';
import { currencyToCents, formatCurrencyInput, formatDocument, formatPhone, unformatDocument, unformatPhone } from '@/lib/input-masks';
import { paidPixCents } from '@/lib/charge-rules';
import type { ChargeSplitLike } from '@/lib/charge-rules';
import { toast } from '@/hooks/use-toast';

const formatBRL = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

/** Subconjunto da cobrança necessário para edição. */
export interface EditableCharge {
  id: string;
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: number;
  description?: string | null;
  payment_method?: string | null;
  pix_amount?: number | null;
  card_amount?: number | null;
  installments?: number | null;
  boleto_linha_digitavel?: string | null;
  boleto_pix_cartao_linha_digitavel?: string | null;
  splits?: ChargeSplitLike[];
}

interface EditChargeDialogProps {
  charge: EditableCharge | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe a cobrança já atualizada pelo servidor. */
  onSaved: (charge: Record<string, unknown>) => void;
}

interface FormState {
  payer_name: string;
  payer_email: string;
  payer_phone: string;
  payer_document: string;
  amount: string;       // "1.234,56"
  pix_amount: string;
  card_amount: string;
  installments: string;
  boleto_linha_digitavel: string;
  description: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const centsToInput = (cents: number | null | undefined) =>
  cents && cents > 0 ? formatCurrencyInput(String(cents)) : '';

const buildInitialState = (charge: EditableCharge): FormState => {
  const method = charge.payment_method || 'cartao';
  // No combinado, o campo de PIX representa só a parte AINDA A PAGAR (o já pago fica travado)
  const pendingPix = Math.max(0, (charge.pix_amount || 0) - paidPixCents(charge));
  return {
    payer_name: charge.payer_name || '',
    payer_email: charge.payer_email || '',
    payer_phone: formatPhone(charge.payer_phone || ''),
    payer_document: formatDocument(charge.payer_document || ''),
    amount: centsToInput(charge.amount),
    pix_amount: centsToInput(pendingPix),
    card_amount: centsToInput(charge.card_amount),
    installments: String(charge.installments || 1),
    boleto_linha_digitavel: (method === 'cartao_pix' ? charge.boleto_pix_cartao_linha_digitavel : charge.boleto_linha_digitavel) || '',
    description: charge.description || '',
  };
};

export function EditChargeDialog({ charge, open, onOpenChange, onSaved }: EditChargeDialogProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // Recarrega o formulário sempre que abrir para uma cobrança
  useEffect(() => {
    if (open && charge) {
      setForm(buildInitialState(charge));
      setErrors({});
    }
  }, [open, charge]);

  if (!charge || !form) return null;

  const method = charge.payment_method || 'cartao';
  const isCombined = method === 'cartao_pix';
  const hasCard = method === 'cartao' || isCombined;
  const paidPix = isCombined ? paidPixCents(charge) : 0;
  const hasPaidPix = paidPix > 0;

  // Soma ao vivo para o operador conferir: PIX pago + novo PIX + cartão
  const liveSum = isCombined
    ? paidPix + currencyToCents(form.pix_amount) + currencyToCents(form.card_amount)
    : null;
  const liveTotal = currencyToCents(form.amount);

  const set = (field: keyof FormState, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  // No combinado o cartão é derivado: cartão = total − PIX pago − PIX a pagar.
  // Assim a soma sempre bate com o total cadastrado, sem o operador precisar calcular.
  const applyDerivedCard = (next: FormState): FormState => {
    if (!isCombined) return next;
    const card = currencyToCents(next.amount) - paidPix - currencyToCents(next.pix_amount);
    return { ...next, card_amount: card > 0 ? centsToInput(card) : '' };
  };

  const setPix = (raw: string) => {
    const pix_amount = formatCurrencyInput(raw);
    setForm((prev) => (prev ? applyDerivedCard({ ...prev, pix_amount }) : prev));
    setErrors((prev) => ({ ...prev, pix_amount: undefined, card_amount: undefined }));
  };

  const setTotal = (raw: string) => {
    const amount = formatCurrencyInput(raw);
    setForm((prev) => (prev ? applyDerivedCard({ ...prev, amount }) : prev));
    setErrors((prev) => ({ ...prev, amount: undefined, card_amount: undefined }));
  };

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.payer_name.trim()) e.payer_name = 'Nome é obrigatório';
    if (!/\S+@\S+\.\S+/.test(form.payer_email)) e.payer_email = 'E-mail inválido';
    const phone = unformatPhone(form.payer_phone);
    if (phone.length < 10 || phone.length > 11) e.payer_phone = 'Telefone deve ter 10 ou 11 dígitos';
    const doc = unformatDocument(form.payer_document);
    if (doc.length !== 11 && doc.length !== 14) e.payer_document = 'CPF deve ter 11 dígitos ou CNPJ 14';

    const amount = currencyToCents(form.amount);
    if (amount <= 0) e.amount = 'Valor é obrigatório';

    if (isCombined) {
      const pix = currencyToCents(form.pix_amount); // parte do PIX ainda a pagar (0 = sem novo PIX)
      const card = currencyToCents(form.card_amount);
      if (!hasPaidPix && pix <= 0) e.pix_amount = 'Valor do PIX é obrigatório';
      if (paidPix + pix >= amount) {
        e.pix_amount = `${hasPaidPix ? 'PIX pago + novo PIX' : 'PIX'} (${formatBRL(paidPix + pix)}) precisa ser menor que o total (${formatBRL(amount)}) para sobrar valor no cartão`;
      } else if (card <= 0) {
        e.card_amount = 'Valor do cartão é obrigatório';
      }
      const sum = paidPix + pix + card;
      if (card > 0 && sum !== amount) {
        e.card_amount = `${hasPaidPix ? 'PIX pago + novo PIX + Cartão' : 'PIX + Cartão'} (${formatBRL(sum)}) deve ser igual ao total (${formatBRL(amount)})`;
      }
    }

    if (hasCard) {
      const n = parseInt(form.installments, 10);
      if (!n || n < 1 || n > 21) e.installments = 'Parcelas entre 1 e 21';
      if (form.boleto_linha_digitavel.replace(/\D/g, '').length !== 47) {
        e.boleto_linha_digitavel = 'Linha digitável deve ter exatamente 47 dígitos';
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const amount = currencyToCents(form.amount);
      const { data, error } = await supabase.functions.invoke('update-charge', {
        body: {
          chargeId: charge.id,
          payer_name: form.payer_name.trim(),
          payer_email: form.payer_email.trim(),
          payer_phone: unformatPhone(form.payer_phone),
          payer_document: unformatDocument(form.payer_document),
          amount,
          pix_amount: isCombined ? currencyToCents(form.pix_amount) : null,
          card_amount: isCombined ? currencyToCents(form.card_amount) : null,
          description: form.description.trim() || null,
          installments: hasCard ? parseInt(form.installments, 10) : 1,
          boleto_linha_digitavel: hasCard ? form.boleto_linha_digitavel.replace(/\D/g, '') : null,
        },
      });

      if (error) {
        const detail = await getFunctionErrorMessage(error);
        throw new Error(detail || error.message || 'Erro ao salvar');
      }
      if (!data?.success) {
        throw new Error(data?.message || data?.error || 'Erro ao salvar');
      }

      const changes: string[] = data.changes || [];
      const pixMsg = changes.includes('novo_pix_criado')
        ? 'Um novo PIX foi criado para o saldo informado; o QR Code é gerado quando o cliente abrir o link.'
        : changes.includes('qr_pix_regenerado')
        ? 'Valor do PIX alterado: um novo QR Code será gerado quando o cliente abrir o link.'
        : changes.includes('pix_pendente_cancelado')
        ? 'O PIX pendente foi cancelado; o saldo ficou todo no cartão.'
        : 'Os dados da cobrança e do link de pagamento foram atualizados.';
      toast({ title: 'Cobrança atualizada', description: pixMsg });
      onSaved(data.charge);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Não foi possível editar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (field: keyof FormState) =>
    errors[field] ? <p className="text-xs text-destructive">{errors[field]}</p> : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar cobrança</DialogTitle>
          <DialogDescription>
            Disponível enquanto nenhum pagamento for concluído. O link de pagamento é atualizado junto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-payer-name">Nome Completo</Label>
            <Input id="edit-payer-name" value={form.payer_name} onChange={(e) => set('payer_name', e.target.value)} className={errors.payer_name ? 'border-destructive' : ''} />
            {fieldError('payer_name')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-payer-document">CPF/CNPJ</Label>
              <Input id="edit-payer-document" inputMode="numeric" value={form.payer_document} onChange={(e) => set('payer_document', formatDocument(e.target.value))} className={errors.payer_document ? 'border-destructive' : ''} />
              {fieldError('payer_document')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-payer-phone">Telefone</Label>
              <Input id="edit-payer-phone" inputMode="tel" value={form.payer_phone} onChange={(e) => set('payer_phone', formatPhone(e.target.value))} className={errors.payer_phone ? 'border-destructive' : ''} />
              {fieldError('payer_phone')}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-payer-email">E-mail</Label>
            <Input id="edit-payer-email" type="email" value={form.payer_email} onChange={(e) => set('payer_email', e.target.value)} className={errors.payer_email ? 'border-destructive' : ''} />
            {fieldError('payer_email')}
          </div>

          <div className={`grid grid-cols-1 ${isCombined ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
            <div className="space-y-1.5">
              <Label htmlFor="edit-amount">Valor total (R$)</Label>
              <Input
                id="edit-amount"
                inputMode="numeric"
                value={form.amount}
                onChange={(e) => setTotal(e.target.value)}
                // Com PIX já pago o total cadastrado fica travado: só o saldo é redistribuído
                disabled={hasPaidPix}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {hasPaidPix && <p className="text-xs text-muted-foreground">Travado: já houve pagamento.</p>}
              {fieldError('amount')}
            </div>
            {isCombined && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-pix-amount">{hasPaidPix ? 'Novo PIX (R$)' : 'Valor PIX (R$)'}</Label>
                  <Input id="edit-pix-amount" inputMode="numeric" value={form.pix_amount} onChange={(e) => setPix(e.target.value)} placeholder={hasPaidPix ? 'Vazio = sem novo PIX' : undefined} className={errors.pix_amount ? 'border-destructive' : ''} />
                  {fieldError('pix_amount')}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-card-amount">Valor Cartão (R$)</Label>
                  <Input id="edit-card-amount" inputMode="numeric" value={form.card_amount} readOnly className={`bg-muted/50 ${errors.card_amount ? 'border-destructive' : ''}`} />
                  <p className="text-xs text-muted-foreground">Calculado: total − PIX{hasPaidPix ? ' pago − novo PIX' : ''}.</p>
                  {fieldError('card_amount')}
                </div>
              </>
            )}
            {hasCard && !isCombined && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-installments">Parcelas</Label>
                <Input id="edit-installments" type="number" min={1} max={21} value={form.installments} onChange={(e) => set('installments', e.target.value)} className={errors.installments ? 'border-destructive' : ''} />
                {fieldError('installments')}
              </div>
            )}
          </div>

          {isCombined && (
            <div className={`rounded-lg border p-3 text-sm ${liveSum === liveTotal ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
              {hasPaidPix && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PIX já pago (travado)</span>
                  <span className="font-medium">{formatBRL(paidPix)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{hasPaidPix ? 'PIX pago + novo PIX + cartão' : 'PIX + cartão'}</span>
                <span className="font-medium">{formatBRL(liveSum ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total da cobrança</span>
                <span className={`font-semibold ${liveSum === liveTotal ? 'text-green-700' : 'text-amber-700'}`}>{formatBRL(liveTotal)}</span>
              </div>
            </div>
          )}

          {isCombined && (
            <div className="space-y-1.5 sm:w-1/3">
              <Label htmlFor="edit-installments-c">Parcelas (cartão)</Label>
              <Input id="edit-installments-c" type="number" min={1} max={21} value={form.installments} onChange={(e) => set('installments', e.target.value)} className={errors.installments ? 'border-destructive' : ''} />
              {fieldError('installments')}
            </div>
          )}

          {hasCard && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-boleto">Linha digitável do boleto</Label>
              <Input id="edit-boleto" inputMode="numeric" value={form.boleto_linha_digitavel} onChange={(e) => set('boleto_linha_digitavel', e.target.value)} placeholder="47 dígitos" className={errors.boleto_linha_digitavel ? 'border-destructive' : ''} />
              {fieldError('boleto_linha_digitavel')}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Descrição (uso interno)</Label>
            <Textarea id="edit-description" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
