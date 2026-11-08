// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * delete-user-admin — remoção de usuário pelo administrador, com service role.
 *
 * Por que existe: a tela removia direto no banco, em duas chamadas (user_roles e profiles). Sem política
 * de DELETE em profiles, a segunda afetava 0 linhas em silêncio e a primeira já tinha apagado o papel do
 * usuário. Aqui a operação é atômica na prática e com regras:
 *   - só admin logado chama; não pode remover a si mesmo;
 *   - usuário com cobranças ou assinaturas NÃO é apagado (as FKs impedem e o histórico precisa dele):
 *     responde { success:false, error:'tem_historico', cobrancas } e a tela oferece desativar;
 *   - sem histórico: apaga user_roles, profiles e o usuário em auth, nesta ordem.
 *
 * Entrada: { userId }. Saída: { success:true, deleted:true } | { success:false, error, message, cobrancas? }.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Quem chama precisa ser admin
    const bearer = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(bearer);
    if (!caller) return json({ success: false, error: "nao_autorizado", message: "Sessão inválida" }, 401);
    const { data: callerRole } = await supabase.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle();
    if (callerRole?.role !== "admin") return json({ success: false, error: "nao_autorizado", message: "Somente administradores" }, 403);

    const { userId } = await req.json().catch(() => ({}));
    if (!userId || !/^[0-9a-f-]{36}$/i.test(String(userId))) return json({ success: false, error: "user_id_invalido", message: "userId inválido" }, 400);
    if (userId === caller.id) return json({ success: false, error: "auto_remocao", message: "Você não pode remover o seu próprio usuário" }, 400);

    const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("id", userId).maybeSingle();
    if (!profile) return json({ success: false, error: "nao_encontrado", message: "Perfil não encontrado" }, 404);

    // Histórico impede a exclusão (FKs NO ACTION em charges.created_by e subscriptions.owner_id)
    const [{ count: cobrancas }, { count: assinaturas }] = await Promise.all([
      supabase.from("charges").select("id", { count: "exact", head: true }).eq("created_by", userId),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("owner_id", userId),
    ]);
    if ((cobrancas || 0) > 0 || (assinaturas || 0) > 0) {
      return json({
        success: false,
        error: "tem_historico",
        message: `${profile.full_name} tem ${cobrancas || 0} cobrança(s) e ${assinaturas || 0} assinatura(s) vinculadas e não pode ser apagado. Desative o usuário.`,
        cobrancas: cobrancas || 0,
        assinaturas: assinaturas || 0,
      }, 200);
    }

    const { error: e1 } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from("profiles").delete().eq("id", userId);
    if (e2) throw e2;
    const { error: e3 } = await supabase.auth.admin.deleteUser(userId);
    if (e3) console.error("[delete-user-admin] perfil apagado, mas auth.deleteUser falhou:", e3.message);

    console.log("[delete-user-admin] removido", { userId, by: caller.id, authDeleted: !e3 });
    return json({ success: true, deleted: true, authDeleted: !e3 });
  } catch (e) {
    console.error("[delete-user-admin] erro:", e);
    return json({ success: false, error: "erro_interno", message: e instanceof Error ? e.message : String(e) }, 200);
  }
});
