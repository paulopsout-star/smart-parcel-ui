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

  if (!['GET', 'POST', 'OPTIONS'].includes(req.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('[company-settings] 📥 Requisição recebida');
    console.log('[company-settings] 🔍 Method:', req.method);
    console.log('[company-settings] 🔐 Authorization header:', req.headers.get('Authorization') ? 'Presente' : 'AUSENTE');
    
    // Verificar autenticação
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      console.error('[company-settings] ❌ Authorization header ausente');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[company-settings] 🔍 Verificando usuário...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verificar se o usuário está autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('[company-settings] ❌ Usuário não autenticado:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[company-settings] ✅ User authenticated:', user.id);

    // Retornar configurações do credor a partir das variáveis de ambiente
    const settings = {
      creditor_document: Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '',
      creditor_name: Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || '',
      merchant_id: Deno.env.get('QUITA_MAIS_MERCHANT_ID') || '',
    };

    console.log('[company-settings] 🔍 Secrets carregados:', {
      has_creditor_document: !!settings.creditor_document,
      has_creditor_name: !!settings.creditor_name,
      has_merchant_id: !!settings.merchant_id,
      creditor_document_length: settings.creditor_document.length,
      creditor_name_length: settings.creditor_name.length,
      merchant_id_length: settings.merchant_id.length
    });

    console.log('[company-settings] 📤 Retornando configurações (censurado):', {
      creditor_document: settings.creditor_document ? '***' + settings.creditor_document.slice(-4) : 'VAZIO',
      creditor_name: settings.creditor_name || 'VAZIO',
      merchant_id: settings.merchant_id ? '***' + settings.merchant_id.slice(-4) : 'VAZIO',
    });

    return new Response(JSON.stringify(settings), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in company-settings function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
