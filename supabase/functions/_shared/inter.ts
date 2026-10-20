/**
 * Cliente da API de Cobrança v3 do Banco Inter (boleto com PIX).
 *
 * Autenticação: OAuth2 client_credentials sobre mTLS (certificado + chave da aplicação cadastrada
 * no Internet Banking PJ). O runtime das edge functions aceita certificado de cliente via
 * Deno.createHttpClient — validado em 20/10/2026 contra client.badssl.com.
 *
 * Secrets (painel Supabase → Edge Functions → Secrets):
 *   INTER_CLIENT_ID, INTER_CLIENT_SECRET
 *   INTER_CERT   — certificado da aplicação (PEM) ou o PEM em base64
 *   INTER_KEY    — chave privada da aplicação (PEM) ou o PEM em base64
 *   INTER_CONTA_CORRENTE — opcional; só quando a aplicação enxerga mais de uma conta
 *   INTER_ENV    — 'production' | 'sandbox' (padrão: sandbox)
 *   INTER_PAGADOR_ENDERECO — JSON {"endereco","bairro","cidade","uf","cep"} usado quando a
 *                            cobrança não tem endereço do pagador (a API exige endereço)
 *
 * Caminhos/campos vieram de SDKs e integrações públicas (inter.js, bancointer-python,
 * bancointer-whmcs); confirmar no sandbox antes de produção.
 */

export const INTER_HOSTS = {
  production: 'https://cdpj.partners.bancointer.com.br',
  sandbox: 'https://cdpj-sandbox.partners.uatinter.co',
} as const;

export const INTER_SCOPES = 'boleto-cobranca.read boleto-cobranca.write webhook.read webhook.write';

export interface InterConfig {
  env: 'production' | 'sandbox';
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  cert: string;
  key: string;
  contaCorrente?: string;
}

export interface InterPagador {
  cpfCnpj: string;
  tipoPessoa: 'FISICA' | 'JURIDICA';
  nome: string;
  endereco: string;
  bairro?: string;
  cidade: string;
  uf: string;
  cep: string;
  email?: string;
  ddd?: string;
  telefone?: string;
}

export interface InterEmitirRequest {
  seuNumero: string;          // até 15 caracteres — usamos parte do id da cobrança
  valorNominal: number;       // em reais, 2 casas
  dataVencimento: string;     // YYYY-MM-DD
  numDiasAgenda: number;      // dias após o vencimento em que o boleto ainda pode ser pago (0–60)
  pagador: InterPagador;
  mensagem?: { linha1?: string; linha2?: string };
}

export interface InterCobranca {
  cobranca?: {
    codigoSolicitacao?: string;
    seuNumero?: string;
    situacao?: string;        // EM_PROCESSAMENTO | A_RECEBER | RECEBIDO | CANCELADO | EXPIRADO | ...
    valorNominal?: number;
    valorTotalRecebido?: number;
    dataVencimento?: string;
    dataSituacao?: string;
  };
  boleto?: {
    nossoNumero?: string;
    codigoBarras?: string;
    linhaDigitavel?: string;
  };
  pix?: {
    txid?: string;
    pixCopiaECola?: string;
  };
  [k: string]: unknown;
}

function decodePem(value: string): string {
  const v = value.trim();
  if (v.startsWith('-----BEGIN')) return v.replace(/\\n/g, '\n');
  // base64 do PEM
  try {
    const decoded = atob(v.replace(/\s+/g, ''));
    if (decoded.includes('-----BEGIN')) return decoded;
  } catch { /* não era base64 */ }
  throw new Error('INTER_CERT/INTER_KEY precisam ser PEM (-----BEGIN ...) ou PEM em base64');
}

export function interConfig(): InterConfig {
  const env = (Deno.env.get('INTER_ENV') || 'sandbox') === 'production' ? 'production' : 'sandbox';
  const clientId = Deno.env.get('INTER_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('INTER_CLIENT_SECRET') || '';
  const certRaw = Deno.env.get('INTER_CERT') || '';
  const keyRaw = Deno.env.get('INTER_KEY') || '';
  const missing = [
    !clientId && 'INTER_CLIENT_ID',
    !clientSecret && 'INTER_CLIENT_SECRET',
    !certRaw && 'INTER_CERT',
    !keyRaw && 'INTER_KEY',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Integração Inter não configurada: faltam ${missing.join(', ')}`);
  return {
    env,
    baseUrl: INTER_HOSTS[env],
    clientId,
    clientSecret,
    cert: decodePem(certRaw),
    key: decodePem(keyRaw),
    contaCorrente: Deno.env.get('INTER_CONTA_CORRENTE') || undefined,
  };
}

let httpClient: Deno.HttpClient | null = null;
function client(cfg: InterConfig): Deno.HttpClient {
  if (!httpClient) {
    // deno-lint-ignore no-explicit-any
    httpClient = (Deno as any).createHttpClient({ cert: cfg.cert, key: cfg.key });
  }
  return httpClient!;
}

// Token em cache por isolate (validade 1h; limite de 5 tokens/min no Inter)
let cachedToken: { value: string; expiresAt: number; scope: string } | null = null;

export async function getInterToken(cfg: InterConfig, scope: string = INTER_SCOPES): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.scope === scope && cachedToken.expiresAt - 60_000 > now) return cachedToken.value;

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'client_credentials',
    scope,
  });
  const res = await fetch(`${cfg.baseUrl}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    // deno-lint-ignore no-explicit-any
    client: client(cfg) as any,
  } as RequestInit);
  const text = await res.text();
  if (!res.ok) throw new Error(`Inter token HTTP ${res.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error(`Inter token sem access_token: ${text.slice(0, 300)}`);
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (Number(data.expires_in) || 3600) * 1000,
    scope,
  };
  return cachedToken.value;
}

async function interFetch<T = unknown>(
  cfg: InterConfig,
  path: string,
  init: { method?: string; body?: unknown; accept?: string } = {},
): Promise<{ status: number; data: T; raw: string }> {
  const token = await getInterToken(cfg);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: init.accept || 'application/json',
  };
  if (cfg.contaCorrente) headers['x-conta-corrente'] = cfg.contaCorrente;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    // deno-lint-ignore no-explicit-any
    client: client(cfg) as any,
  } as RequestInit);
  const raw = await res.text();
  let data: unknown = raw;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* texto */ }
  return { status: res.status, data: data as T, raw };
}

/** POST /cobranca/v3/cobrancas — assíncrono; devolve codigoSolicitacao. */
export async function emitirCobranca(cfg: InterConfig, req: InterEmitirRequest): Promise<string> {
  const r = await interFetch<{ codigoSolicitacao?: string }>(cfg, '/cobranca/v3/cobrancas', { method: 'POST', body: req });
  if (r.status < 200 || r.status >= 300 || !r.data?.codigoSolicitacao) {
    throw new Error(`Inter emitir HTTP ${r.status}: ${r.raw.slice(0, 500)}`);
  }
  return r.data.codigoSolicitacao;
}

/** GET /cobranca/v3/cobrancas/{codigoSolicitacao} */
export async function recuperarCobranca(cfg: InterConfig, codigoSolicitacao: string): Promise<InterCobranca> {
  const r = await interFetch<InterCobranca>(cfg, `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}`);
  if (r.status !== 200) throw new Error(`Inter recuperar HTTP ${r.status}: ${r.raw.slice(0, 500)}`);
  return r.data;
}

/** Aguarda a cobrança sair de EM_PROCESSAMENTO (emissão assíncrona). */
export async function waitUntilIssued(cfg: InterConfig, codigoSolicitacao: string, maxMs = 25_000, intervalMs = 1_500): Promise<InterCobranca> {
  const deadline = Date.now() + maxMs;
  let last: InterCobranca | null = null;
  while (Date.now() < deadline) {
    last = await recuperarCobranca(cfg, codigoSolicitacao);
    const situacao = last.cobranca?.situacao;
    if (situacao && situacao !== 'EM_PROCESSAMENTO' && last.boleto?.linhaDigitavel) return last;
    if (situacao === 'CANCELADO' || situacao === 'EXPIRADO') return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Inter: cobrança ${codigoSolicitacao} ainda EM_PROCESSAMENTO após ${maxMs}ms (situação=${last?.cobranca?.situacao})`);
}

/** POST /cobranca/v3/cobrancas/{codigoSolicitacao}/cancelar */
export async function cancelarCobranca(cfg: InterConfig, codigoSolicitacao: string, motivoCancelamento: string): Promise<void> {
  const r = await interFetch(cfg, `/cobranca/v3/cobrancas/${encodeURIComponent(codigoSolicitacao)}/cancelar`, {
    method: 'POST',
    body: { motivoCancelamento },
  });
  if (r.status < 200 || r.status >= 300) throw new Error(`Inter cancelar HTTP ${r.status}: ${r.raw.slice(0, 500)}`);
}

/** PUT /cobranca/v3/cobrancas/webhook */
export async function setWebhook(cfg: InterConfig, webhookUrl: string): Promise<void> {
  const r = await interFetch(cfg, '/cobranca/v3/cobrancas/webhook', { method: 'PUT', body: { webhookUrl } });
  if (r.status < 200 || r.status >= 300) throw new Error(`Inter webhook HTTP ${r.status}: ${r.raw.slice(0, 500)}`);
}

/** GET /cobranca/v3/cobrancas/webhook */
export async function getWebhook(cfg: InterConfig): Promise<unknown> {
  const r = await interFetch(cfg, '/cobranca/v3/cobrancas/webhook');
  return { status: r.status, data: r.data };
}

/** Endereço padrão do pagador (secret INTER_PAGADOR_ENDERECO) — a API exige endereço completo. */
export function enderecoPadrao(): Pick<InterPagador, 'endereco' | 'bairro' | 'cidade' | 'uf' | 'cep'> | null {
  const raw = Deno.env.get('INTER_PAGADOR_ENDERECO');
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (!j.endereco || !j.cidade || !j.uf || !j.cep) return null;
    return { endereco: j.endereco, bairro: j.bairro, cidade: j.cidade, uf: j.uf, cep: String(j.cep).replace(/\D/g, '') };
  } catch {
    return null;
  }
}

/** Vencimento: hoje (fuso SP) se antes das 19:00, senão amanhã. YYYY-MM-DD. */
export function vencimentoPadrao(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = parseInt(parts.hour, 10);
  const today = Date.UTC(+parts.year, +parts.month - 1, +parts.day);
  const target = hour >= 19 ? today + 86_400_000 : today;
  return new Date(target).toISOString().slice(0, 10);
}
