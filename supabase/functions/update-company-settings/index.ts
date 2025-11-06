import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar autenticação com anon key
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se usuário é admin
    const { data: profile, error: profileError } = await supabaseAuth
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('[update-company-settings] Access denied - not admin:', user.id);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[update-company-settings] Admin authenticated:', user.id);

    // Parse body
    const { creditor_document, creditor_name, merchant_id } = await req.json();

    // Validações básicas
    if (creditor_document && typeof creditor_document !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid creditor_document' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (creditor_name && typeof creditor_name !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid creditor_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (merchant_id && typeof merchant_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid merchant_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[update-company-settings] Updating secrets...');

    // Usar Supabase Management API para atualizar secrets
    const projectRef = supabaseUrl.split('//')[1].split('.')[0];
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/secrets`;

    const updates: Array<{ name: string; value: string }> = [];

    if (creditor_document) {
      updates.push({ name: 'QUITA_MAIS_CREDITOR_DOCUMENT', value: creditor_document });
    }
    if (creditor_name) {
      updates.push({ name: 'QUITA_MAIS_CREDITOR_NAME', value: creditor_name });
    }
    if (merchant_id) {
      updates.push({ name: 'QUITA_MAIS_MERCHANT_ID', value: merchant_id });
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NOTA: A API de Management do Supabase requer um token de acesso pessoal
    // Como não temos acesso direto à Management API aqui, vamos apenas simular
    // a atualização e retornar sucesso. Em produção, o admin deveria atualizar
    // as secrets manualmente no dashboard do Supabase ou via CLI.
    
    console.log('[update-company-settings] Secrets update simulated:', {
      count: updates.length,
      secrets: updates.map(u => u.name)
    });

    // Retornar instrução para o admin
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Para aplicar as alterações, atualize as secrets no Supabase Dashboard:',
      instructions: [
        '1. Acesse: https://supabase.com/dashboard/project/' + projectRef + '/settings/functions',
        '2. Clique em "Add new secret" ou edite as existentes',
        '3. Atualize os valores conforme necessário:',
        ...updates.map(u => `   - ${u.name}`)
      ],
      updates
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in update-company-settings function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
