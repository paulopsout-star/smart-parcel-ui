/**
 * Utilidades de boleto bancário.
 *
 * Linha digitável de 47 dígitos (boleto bancário/cobrança): o valor está nos 10 últimos
 * dígitos (posições 38–47), em centavos. Valor 0 significa "em aberto".
 * Linha de 48 dígitos (arrecadação/convênio) tem outro layout e não é tratada aqui.
 */
export function boletoValueCents(linha: string | null | undefined): number | null {
  const digits = (linha || '').replace(/\D/g, '');
  if (digits.length !== 47) return null;
  const value = parseInt(digits.slice(37, 47), 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}
