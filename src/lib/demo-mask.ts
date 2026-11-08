/**
 * Mascaramento de dados pessoais para o acesso de demonstração.
 *
 * O usuário demo enxerga cobranças reais da empresa à qual pertence (RLS), então nome,
 * documento, e-mail e telefone do pagador são ofuscados antes de chegar à tela.
 * Só é aplicado quando `isDemo` (AuthContext) é verdadeiro.
 */

const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

/** "MARIA APARECIDA DA SILVA" -> "Maria A. S." */
export function maskName(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const initials = parts
    .slice(1)
    .filter((p) => p.length > 2) // ignora "da", "de", "dos"
    .map((p) => p.charAt(0).toUpperCase() + '.')
    .join(' ');
  return initials ? `${first} ${initials}` : first;
}

/** CPF "04774417505" -> "***.744.175-**"; CNPJ "11222333000181" -> "**.222.333/0001-**" */
export function maskDocument(doc: string | null | undefined): string {
  const d = digits(doc);
  if (d.length === 11) return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return d ? '***' : '';
}

/** "maria.silva@gmail.com" -> "m***@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? '').trim();
  const at = e.indexOf('@');
  if (at <= 0) return e ? '***' : '';
  return `${e.charAt(0)}***${e.slice(at)}`;
}

/** "11987654321" -> "11*****4321" (mantém DDD e os 4 últimos; formatPhone continua funcionando) */
export function maskPhone(phone: string | null | undefined): string {
  const d = digits(phone);
  if (d.length < 8) return d ? '***' : '';
  return `${d.slice(0, 2)}${'*'.repeat(d.length - 6)}${d.slice(-4)}`;
}

type PayerLike = {
  payer_name?: string | null;
  payer_document?: string | null;
  payer_email?: string | null;
  payer_phone?: string | null;
};

/** Devolve uma cópia da cobrança com os dados do pagador mascarados. */
export function maskChargePayer<T extends PayerLike>(charge: T): T {
  return {
    ...charge,
    payer_name: maskName(charge.payer_name),
    payer_document: maskDocument(charge.payer_document),
    payer_email: maskEmail(charge.payer_email),
    payer_phone: maskPhone(charge.payer_phone),
  };
}

type HolderLike = {
  holder_name?: string | null;
  holder_document?: string | null;
  holder_email?: string | null;
  holder_phone?: string | null;
};

/** Devolve uma cópia dos dados do portador do cartão com PII mascarada. */
export function maskCardHolder<T extends HolderLike>(holder: T): T {
  return {
    ...holder,
    holder_name: maskName(holder.holder_name),
    holder_document: maskDocument(holder.holder_document),
    holder_email: holder.holder_email ? maskEmail(holder.holder_email) : holder.holder_email,
    holder_phone: holder.holder_phone ? maskPhone(holder.holder_phone) : holder.holder_phone,
  };
}
