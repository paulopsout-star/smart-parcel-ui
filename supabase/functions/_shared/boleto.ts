/**
 * Utilidades de boleto — leitura e validação OFFLINE da linha digitável.
 *
 * Cópia de src/lib/boleto.ts (manter em sincronia).
 *
 * Boleto bancário/cobrança (47 dígitos):
 *   AAABC.CCCCX  DDDDD.DDDDDY  EEEEE.EEEEEZ  K  FFFFVVVVVVVVVV
 *   campo 1 (9+DV) · campo 2 (10+DV) · campo 3 (10+DV) · DV geral · fator(4) + valor(10)
 *   Código de barras (44) = banco(3) moeda(1) DVgeral(1) fator(4) valor(10) campo livre(25)
 *
 * Boleto de arrecadação/convênio (48 dígitos): 4 blocos de 11 dígitos + DV cada.
 *   Código de barras (44) = os 4 blocos sem DV. Posição 3 = identificador de valor
 *   (6/7 → DV módulo 10, 8/9 → DV módulo 11); valor nas posições 5–15. Não tem vencimento.
 *
 * Fator de vencimento: dias a partir de uma base. Base original 07/10/1997 (fator 1000 =
 * 03/07/2000) esgotou em 21/02/2025 (fator 9999). Desde 22/02/2025 o fator reiniciou em 1000
 * (fator 1000 = 22/02/2025). Qualquer boleto pela base antiga já venceu, então usamos a base
 * nova e só caímos na antiga quando a data resultante ficaria absurdamente no futuro.
 *
 * O que NÃO dá para saber pela linha: se já foi pago, baixado ou teve o valor alterado.
 */

export type BoletoKind = 'bancario' | 'arrecadacao' | 'invalid';

export interface BoletoInfo {
  kind: BoletoKind;
  /** Linha só com dígitos */
  digits: string;
  /** Valor em centavos; null = em aberto/sem valor na linha */
  valueCents: number | null;
  /** 'YYYY-MM-DD'; null = sem vencimento (fator 0000 ou arrecadação) */
  dueDate: string | null;
  /** Código do banco (3 dígitos) — só bancário */
  bankCode: string | null;
  /** Nome do banco, quando conhecido */
  bankName: string | null;
  /** DVs dos campos e DV geral conferem */
  checkDigitsValid: boolean;
  /** Motivos de invalidez (vazio quando válido) */
  problems: string[];
}

export type BoletoDueStatus = 'no_due' | 'ok' | 'due_today' | 'expired';

export interface BoletoDueInfo {
  status: BoletoDueStatus;
  /** Dias até o vencimento (negativo = dias vencido). 0 = vence hoje. null = sem vencimento */
  days: number | null;
  dueDate: string | null;
}

const DAY_MS = 86_400_000;
const NEW_BASE_UTC = Date.UTC(2025, 1, 22); // fator 1000
const OLD_BASE_UTC = Date.UTC(1997, 9, 7); // fator 0

export const BANK_NAMES: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '041': 'Banrisul',
  '070': 'BRB',
  '077': 'Inter',
  '104': 'Caixa',
  '208': 'BTG Pactual',
  '212': 'Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagBank',
  '323': 'Mercado Pago',
  '336': 'C6',
  '341': 'Itaú',
  '364': 'Efí',
  '380': 'PicPay',
  '389': 'Mercantil',
  '403': 'Cora',
  '422': 'Safra',
  '461': 'Asaas',
  '623': 'Pan',
  '655': 'BV',
  '748': 'Sicredi',
  '756': 'Sicoob',
};

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

/** DV módulo 10 (campos da linha digitável bancária e blocos de arrecadação com id 6/7). */
export function mod10(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    let p = parseInt(block[i], 10) * weight;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    sum += p;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

/** DV geral módulo 11 do código de barras bancário (pesos 2–9, resto 0/1 → DV 1). */
export function mod11Bancario(digits43: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits43.length - 1; i >= 0; i--) {
    sum += parseInt(digits43[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** DV módulo 11 de arrecadação (pesos 2–9; resto 0/1 → 0, resto 10 → 1). */
export function mod11Arrecadacao(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i--) {
    sum += parseInt(block[i], 10) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  if (rest === 0 || rest === 1) return 0;
  if (rest === 10) return 1;
  return 11 - rest;
}

function isoFromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Data de vencimento a partir do fator (4 dígitos). */
export function dueDateFromFactor(fator: number, todayIso: string = todayBR()): string | null {
  if (!Number.isFinite(fator) || fator <= 0) return null;
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  if (fator < 1000) {
    // Só existe na base antiga (08/10/1997 a 02/07/2000)
    return isoFromUtcMs(OLD_BASE_UTC + fator * DAY_MS);
  }
  const newBase = NEW_BASE_UTC + (fator - 1000) * DAY_MS;
  // Boleto emitido antes de 22/02/2025 com fator alto cairia décadas à frente: usar base antiga
  if (newBase > todayMs + 5 * 365 * DAY_MS) {
    return isoFromUtcMs(OLD_BASE_UTC + fator * DAY_MS);
  }
  return isoFromUtcMs(newBase);
}

/** Hoje em 'YYYY-MM-DD' no fuso de São Paulo. */
export function todayBR(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA já é YYYY-MM-DD
}

function invalid(digits: string, problems: string[]): BoletoInfo {
  return {
    kind: 'invalid',
    digits,
    valueCents: null,
    dueDate: null,
    bankCode: null,
    bankName: null,
    checkDigitsValid: false,
    problems,
  };
}

/** Lê e valida uma linha digitável (47 ou 48 dígitos). Nunca lança. */
export function parseBoleto(linha: string | null | undefined, todayIso: string = todayBR()): BoletoInfo {
  const digits = onlyDigits(linha);

  if (digits.length === 47) {
    const campo1 = digits.slice(0, 10);
    const campo2 = digits.slice(10, 21);
    const campo3 = digits.slice(21, 32);
    const dvGeral = parseInt(digits[32], 10);
    const campo5 = digits.slice(33, 47);

    const problems: string[] = [];
    if (mod10(campo1.slice(0, 9)) !== parseInt(campo1[9], 10)) problems.push('dígito verificador do campo 1');
    if (mod10(campo2.slice(0, 10)) !== parseInt(campo2[10], 10)) problems.push('dígito verificador do campo 2');
    if (mod10(campo3.slice(0, 10)) !== parseInt(campo3[10], 10)) problems.push('dígito verificador do campo 3');

    // Código de barras: banco(3) moeda(1) DV(1) fator(4) valor(10) campo livre(25)
    const barcodeSemDv = campo1.slice(0, 4) + campo5 + campo1.slice(4, 9) + campo2.slice(0, 10) + campo3.slice(0, 10);
    if (barcodeSemDv.length !== 43) problems.push('estrutura');
    else if (mod11Bancario(barcodeSemDv) !== dvGeral) problems.push('dígito verificador geral');

    const bankCode = digits.slice(0, 3);
    const fator = parseInt(campo5.slice(0, 4), 10);
    const valor = parseInt(campo5.slice(4, 14), 10);

    return {
      kind: problems.length ? 'invalid' : 'bancario',
      digits,
      valueCents: Number.isFinite(valor) && valor > 0 ? valor : null,
      dueDate: dueDateFromFactor(fator, todayIso),
      bankCode,
      bankName: BANK_NAMES[bankCode] ?? null,
      checkDigitsValid: problems.length === 0,
      problems,
    };
  }

  if (digits.length === 48) {
    const blocks = [digits.slice(0, 12), digits.slice(12, 24), digits.slice(24, 36), digits.slice(36, 48)];
    const barcode = blocks.map((b) => b.slice(0, 11)).join('');
    const idValor = parseInt(barcode[2], 10);
    const useMod10 = idValor === 6 || idValor === 7;
    const useMod11 = idValor === 8 || idValor === 9;
    const problems: string[] = [];
    if (barcode[0] !== '8') problems.push('não começa com 8 (arrecadação)');
    if (!useMod10 && !useMod11) problems.push('identificador de valor desconhecido');
    else {
      blocks.forEach((b, i) => {
        const dv = parseInt(b[11], 10);
        const calc = useMod10 ? mod10(b.slice(0, 11)) : mod11Arrecadacao(b.slice(0, 11));
        if (calc !== dv) problems.push(`dígito verificador do bloco ${i + 1}`);
      });
      const semDv = barcode.slice(0, 3) + barcode.slice(4);
      const dvGeral = parseInt(barcode[3], 10);
      const calcGeral = useMod10 ? mod10(semDv) : mod11Arrecadacao(semDv);
      if (calcGeral !== dvGeral) problems.push('dígito verificador geral');
    }
    const valor = parseInt(barcode.slice(4, 15), 10);
    const valorEfetivo = idValor === 6 || idValor === 8; // 7/9 = valor de referência
    return {
      kind: problems.length ? 'invalid' : 'arrecadacao',
      digits,
      valueCents: valorEfetivo && Number.isFinite(valor) && valor > 0 ? valor : null,
      dueDate: null,
      bankCode: null,
      bankName: null,
      checkDigitsValid: problems.length === 0,
      problems,
    };
  }

  return invalid(digits, [digits.length === 0 ? 'vazia' : `${digits.length} dígitos (esperado 47 ou 48)`]);
}

/** Situação de vencimento em relação a hoje (fuso de São Paulo). */
export function boletoDueInfo(info: BoletoInfo, todayIso: string = todayBR()): BoletoDueInfo {
  if (!info.dueDate) return { status: 'no_due', days: null, dueDate: null };
  const due = Date.parse(`${info.dueDate}T00:00:00Z`);
  const today = Date.parse(`${todayIso}T00:00:00Z`);
  const days = Math.round((due - today) / DAY_MS);
  return {
    status: days < 0 ? 'expired' : days === 0 ? 'due_today' : 'ok',
    days,
    dueDate: info.dueDate,
  };
}

/**
 * Valor (centavos) da linha digitável. Mantido por compatibilidade: devolve o valor mesmo
 * quando os DVs não conferem (o chamador decide o que fazer com a validade).
 */
export function boletoValueCents(linha: string | null | undefined): number | null {
  const digits = onlyDigits(linha);
  if (digits.length === 47) {
    const value = parseInt(digits.slice(37, 47), 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (digits.length === 48) return parseBoleto(digits).valueCents;
  return null;
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function formatIsoDateBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
