// @ts-nocheck
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { cancelPendingSiblings, tryCompleteCharge } from "./charge-completion.ts";

/**
 * Helpers compartilhados da integração AbacatePay (API v2 — Checkout Transparente PIX).
 *
 * Contingência (out/2026): usada enquanto a API PIX da Treeal estiver instável.
 * A integração Treeal (`treeal-auth.ts` + funções `treeal-*`) permanece intacta.
 *
 * Secrets:
 *   ABACATEPAY_API_KEY        — chave secreta (Bearer). Chaves de Dev simulam; de produção cobram de verdade.
 *   ABACATEPAY_WEBHOOK_SECRET — opcional; valor esperado no query param ?webhookSecret= do webhook.
 *   ABACATEPAY_API_URL        — opcional; default https://api.abacatepay.com
 *
 * IDs AbacatePay têm prefixo "pix_char_"; txids Treeal são 32 hex. Essa diferença é usada em todo o
 * sistema (front e crons) para rotear cada QR ao provedor que o emitiu.
 */

export const ABACATEPAY_API_URL = (Deno.env.get("ABACATEPAY_API_URL") || "https://api.abacatepay.com")
  .replace(/\/+$/, "");

export function loadAbacatePayConfig() {
  const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
  if (!apiKey) {
    throw new Error("Secret ABACATEPAY_API_KEY ausente. Gere uma chave no painel da AbacatePay e configure-a.");
  }
  return {
    apiKey,
    webhookSecret: Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") || null,
  };
}

export function isAbacatePayId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("pix_char_");
}

/** Mapeia status da AbacatePay para o status interno do split. */
export function mapAbacateStatus(status: string): "pending" | "concluded" | "failed" {
  switch (status) {
    case "PAID":
      return "concluded";
    case "EXPIRED":
    case "CANCELLED":
    case "REFUNDED":
    case "FAILED":
      return "failed";
    default:
      // PENDING, UNDER_DISPUTE e desconhecidos continuam aguardando
      return "pending";
  }
}

interface AbacateEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

export interface AbacateResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  raw: string;
}

/** Chamada genérica à API v2. Nunca lança por resposta não-JSON; `ok` já considera o campo `success`. */
export async function abacateRequest<T>(
  apiKey: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<AbacateResult<T>> {
  const res = await fetch(`${ABACATEPAY_API_URL}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await res.text();
  let envelope: AbacateEnvelope<T> | null = null;
  try {
    envelope = JSON.parse(raw);
  } catch {
    // resposta não-JSON (ex.: HTML de erro do gateway)
  }

  return {
    ok: res.ok && envelope?.success !== false,
    status: res.status,
    data: envelope?.data ?? null,
    error: envelope?.error ?? (res.ok ? null : raw.substring(0, 300)),
    raw,
  };
}

export interface AbacatePixCheck {
  status: string;
  expiresAt: string | null;
}

/** GET /v2/transparents/check — status atual de um QR PIX. Lança em falha de API. */
export async function checkPixStatus(apiKey: string, pixId: string): Promise<AbacatePixCheck> {
  const r = await abacateRequest<{ id: string; status: string; expiresAt?: string }>(
    apiKey,
    "GET",
    `/v2/transparents/check?id=${encodeURIComponent(pixId)}`,
  );
  if (!r.ok || !r.data) {
    throw new Error(`AbacatePay check falhou [${r.status}]: ${r.error ?? "sem detalhes"}`);
  }
  return { status: r.data.status || "PENDING", expiresAt: r.data.expiresAt ?? null };
}

export interface SplitRef {
  id: string;
  charge_id: string | null;
}

/**
 * Persiste o status consultado na AbacatePay no split e, se pago, cancela
 * irmãos pendentes e tenta fechar a charge (regras em charge-completion.ts).
 */
export async function applyPixStatus(
  supabase: SupabaseClient,
  split: SplitRef,
  abacateStatus: string,
): Promise<{ internalStatus: "pending" | "concluded" | "failed"; isPaid: boolean }> {
  const internalStatus = mapAbacateStatus(abacateStatus);
  const isPaid = internalStatus === "concluded";

  const update: Record<string, unknown> = { mp_status: abacateStatus, status: internalStatus };
  if (isPaid) {
    const now = new Date().toISOString();
    update.pix_paid_at = now;
    update.processed_at = now;
  }

  const { error } = await supabase.from("payment_splits").update(update).eq("id", split.id);
  if (error) {
    console.error(`[abacatepay] Falha ao atualizar split ${split.id}:`, error);
  }

  if (isPaid && split.charge_id) {
    await cancelPendingSiblings(supabase, split.charge_id, split.id, "pix");
    await tryCompleteCharge(supabase, split.charge_id);
  }

  return { internalStatus, isPaid };
}
