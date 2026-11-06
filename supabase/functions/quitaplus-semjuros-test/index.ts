// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * quitaplus-semjuros-test — bancada de TESTES DE INTEGRAÇÃO da credencial "sem juros" do Quita+.
 *
 * Função isolada: não é chamada por nenhum fluxo de produção e não altera dados (só lê a API).
 * Existe para validar a nova credencial ANTES de mexer no processo de pagamento.
 *
 * Secrets usados:
 *   QUITAPLUS_BASE_URL                 — mesma URL do fluxo atual
 *   QUITAPLUS_CLIENT_ID / _SECRET      — credencial atual ("padrao", com juros)
 *   QUITAPLUS_SEMJUROS_CLIENT_ID / _SECRET — credencial nova ("sem_juros")
 *   QUITAPLUS_SEMJUROS_MERCHANT_ID     — opcional; padrão = QUITA_MAIS_MERCHANT_ID
 *
 * Autorização: admin (JWT do usuário) OU header `x-test-key` cujo SHA-256 confere com TEST_KEY_SHA256.
 * O token OAuth NUNCA é devolvido nem logado.
 *
 * Ações (POST JSON):
 *   { "action": "status" }                                   — quais secrets existem
 *   { "action": "token", "credential": "sem_juros" }          — obtém token (ok, tempo, validade)
 *   { "action": "simulate", "credential": "...", "amounts": [100000] } — simulação por valor (centavos)
 *   { "action": "compare", "amounts": [100000] }              — simulação lado a lado: padrao x sem_juros
 *   { "action": "prepayment_status", "credential": "...", "prePaymentKey": "uuid" } — consulta de status
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-test-key",
};

// SHA-256 da chave de teste (a chave em si fica fora do repositório)
const TEST_KEY_SHA256 = "b0b2c8f4e79760fdce656e5fdb9cf0654fe40830b6241dd0e541415ff5584c0e";

const UPSTREAM_TIMEOUT_MS = 20_000;

type Credential = "padrao" | "sem_juros";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function authorize(req: Request): Promise<string | null> {
  const testKey = req.headers.get("x-test-key");
  if (testKey && (await sha256Hex(testKey)) === TEST_KEY_SHA256) return "test-key";

  const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  if (!bearer) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user } } = await supabase.auth.getUser(bearer);
  if (!user) return null;
  const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  return role?.role === "admin" ? user.id : null;
}

function baseUrl(): string {
  return (Deno.env.get("QUITAPLUS_BASE_URL") || "https://pay-gt.autonegocie.com").replace(/\/$/, "");
}

function credentialsFor(credential: Credential) {
  if (credential === "sem_juros") {
    return {
      clientId: Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_ID") || "",
      clientSecret: Deno.env.get("QUITAPLUS_SEMJUROS_CLIENT_SECRET") || "",
      merchantId: Deno.env.get("QUITAPLUS_SEMJUROS_MERCHANT_ID") || Deno.env.get("QUITA_MAIS_MERCHANT_ID") || "",
    };
  }
  return {
    clientId: Deno.env.get("QUITAPLUS_CLIENT_ID") || "",
    clientSecret: Deno.env.get("QUITAPLUS_CLIENT_SECRET") || "",
    merchantId: Deno.env.get("QUITA_MAIS_MERCHANT_ID") || "",
  };
}

const mask = (text: string) => text.replace(/[A-Za-z0-9_\-\.]{40,}/g, "<redigido>").slice(0, 400);

// Cache em memória por credencial (só durante a vida do isolate)
const tokenCache: Partial<Record<Credential, { value: string; expiresAt: number }>> = {};

interface TokenResult {
  ok: boolean;
  credential: Credential;
  httpStatus?: number;
  ms: number;
  fromCache?: boolean;
  expiresIn?: number;
  tokenType?: string;
  tokenLength?: number;
  error?: string;
}

async function getToken(credential: Credential, forceNew = false): Promise<{ token: string | null; info: TokenResult }> {
  const started = Date.now();
  const cached = tokenCache[credential];
  if (!forceNew && cached && cached.expiresAt > Date.now() + 60_000) {
    return {
      token: cached.value,
      info: { ok: true, credential, ms: 0, fromCache: true, expiresIn: Math.floor((cached.expiresAt - Date.now()) / 1000) },
    };
  }

  const { clientId, clientSecret } = credentialsFor(credential);
  if (!clientId || !clientSecret) {
    return { token: null, info: { ok: false, credential, ms: 0, error: "Credenciais ausentes nos secrets" } };
  }

  const url = baseUrl().includes("/connect/token") ? baseUrl() : `${baseUrl()}/connect/token`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "AutonegocieHub/quitaplus-semjuros-test",
      },
      body: JSON.stringify({ clientId, clientSecret, grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { token: null, info: { ok: false, credential, httpStatus: res.status, ms, error: mask(text) } };
    }
    const data = JSON.parse(text);
    const token = data?.access_token ?? data?.accessToken ?? data?.token ?? null;
    const expiresIn = Number(data?.expires_in ?? data?.expiresIn ?? 3600);
    if (!token) {
      return { token: null, info: { ok: false, credential, httpStatus: res.status, ms, error: "Resposta sem access_token" } };
    }
    tokenCache[credential] = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
    return {
      token,
      info: {
        ok: true, credential, httpStatus: res.status, ms, fromCache: false, expiresIn,
        tokenType: String(data?.token_type ?? data?.tokenType ?? "Bearer"), tokenLength: String(token).length,
      },
    };
  } catch (e) {
    return { token: null, info: { ok: false, credential, ms: Date.now() - started, error: String(e?.message ?? e) } };
  }
}

async function simulate(credential: Credential, amountInCents: number) {
  const { token, info } = await getToken(credential);
  if (!token) return { credential, amountInCents, ok: false, stage: "token", token: info };

  const { merchantId } = credentialsFor(credential);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl()}/payment/simulation`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "AutonegocieHub/quitaplus-semjuros-test",
        "Origin": "https://autonegocie.com.br",
        "Referer": "https://autonegocie.com.br/",
      },
      body: JSON.stringify({ amountInCents, merchantId }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      return { credential, amountInCents, ok: false, stage: "simulation", httpStatus: res.status, ms, error: mask(text) };
    }
    const raw = JSON.parse(text);
    const conditions = raw?.conditions ?? raw?.simulation?.conditions ?? [];
    // Resumo por condição: acréscimo sobre o valor simulado (0 = sem juros)
    const resumo = (Array.isArray(conditions) ? conditions : []).map((c: any) => {
      const total = Number(c.totalAmount ?? c.total ?? 0);
      const parcela = Number(c.installmentAmount ?? c.installmentValue ?? 0);
      const n = Number(c.installments ?? c.installment ?? 0);
      return {
        parcelas: n,
        valorParcela: parcela,
        total,
        acrescimoCents: total - amountInCents,
        acrescimoPct: amountInCents > 0 ? Number((((total - amountInCents) / amountInCents) * 100).toFixed(2)) : null,
        parcelaVezesN: parcela * n,
      };
    });
    return {
      credential, amountInCents, ok: true, httpStatus: res.status, ms,
      maxParcelas: resumo.reduce((m: number, r: any) => Math.max(m, r.parcelas), 0),
      semJurosEmTodas: resumo.length > 0 && resumo.every((r: any) => r.acrescimoCents === 0),
      resumo,
      camposDaResposta: Object.keys(raw ?? {}),
      camposDaCondicao: conditions?.[0] ? Object.keys(conditions[0]) : [],
      primeiraCondicaoBruta: conditions?.[0] ?? null,
      ultimaCondicaoBruta: conditions?.length ? conditions[conditions.length - 1] : null,
    };
  } catch (e) {
    return { credential, amountInCents, ok: false, stage: "simulation", ms: Date.now() - started, error: String(e?.message ?? e) };
  }
}

async function prepaymentStatus(credential: Credential, prePaymentKey: string) {
  if (!/^[0-9a-fA-F-]{20,64}$/.test(prePaymentKey)) return { ok: false, error: "prePaymentKey inválido" };
  const { token, info } = await getToken(credential);
  if (!token) return { credential, ok: false, stage: "token", token: info };
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl()}/prepayment/status/${encodeURIComponent(prePaymentKey)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "User-Agent": "AutonegocieHub/quitaplus-semjuros-test",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const text = await res.text();
    let body: unknown = mask(text);
    try { body = JSON.parse(text); } catch { /* mantém texto mascarado */ }
    return { credential, ok: res.ok, httpStatus: res.status, ms: Date.now() - started, body };
  } catch (e) {
    return { credential, ok: false, ms: Date.now() - started, error: String(e?.message ?? e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  const actor = await authorize(req);
  if (!actor) return json({ error: "Não autorizado" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }
  const action = String(body?.action || "status");
  const credential: Credential = body?.credential === "padrao" ? "padrao" : "sem_juros";
  const amounts: number[] = (Array.isArray(body?.amounts) ? body.amounts : [100000])
    .map((n: unknown) => Math.round(Number(n)))
    .filter((n: number) => Number.isFinite(n) && n > 0)
    .slice(0, 12);

  console.log("[quitaplus-semjuros-test]", { action, credential, amounts: amounts.length, actor: actor === "test-key" ? actor : "admin" });

  try {
    if (action === "status") {
      const sj = credentialsFor("sem_juros");
      const pd = credentialsFor("padrao");
      return json({
        baseUrl: baseUrl(),
        padrao: { clientId: !!pd.clientId, clientSecret: !!pd.clientSecret, merchantId: !!pd.merchantId },
        sem_juros: {
          clientId: !!sj.clientId,
          clientSecret: !!sj.clientSecret,
          merchantIdProprio: !!Deno.env.get("QUITAPLUS_SEMJUROS_MERCHANT_ID"),
          merchantIdEfetivo: !!sj.merchantId,
          mesmaCredencialQueAPadrao: !!sj.clientId && sj.clientId === pd.clientId,
        },
      });
    }

    if (action === "token") {
      const { info } = await getToken(credential, body?.forceNew === true);
      return json(info);
    }

    if (action === "simulate") {
      const results = [];
      for (const amount of amounts) results.push(await simulate(credential, amount));
      return json({ credential, results });
    }

    if (action === "compare") {
      const results = [];
      for (const amount of amounts) {
        const [padrao, semJuros] = await Promise.all([simulate("padrao", amount), simulate("sem_juros", amount)]);
        results.push({ amountInCents: amount, padrao, sem_juros: semJuros });
      }
      return json({ results });
    }

    if (action === "prepayment_status") {
      return json(await prepaymentStatus(credential, String(body?.prePaymentKey || "")));
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[quitaplus-semjuros-test] erro", e);
    return json({ error: "erro_interno", message: String(e?.message ?? e) }, 500);
  }
});
