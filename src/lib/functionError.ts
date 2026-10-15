import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Extrai a mensagem de erro retornada no corpo JSON de uma Edge Function
 * (`{ error, message }`). `supabase.functions.invoke` devolve só um
 * FunctionsHttpError genérico quando a função responde com status != 2xx,
 * então sem isso a UI nunca vê o motivo real da falha.
 */
export async function getFunctionErrorMessage(err: unknown): Promise<string | null> {
  if (!(err instanceof FunctionsHttpError)) return null;
  try {
    const body = await err.context.json();
    const msg = body?.message ?? body?.error;
    return typeof msg === 'string' && msg ? msg : null;
  } catch {
    return null;
  }
}
