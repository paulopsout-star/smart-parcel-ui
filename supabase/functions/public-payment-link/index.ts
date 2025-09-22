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

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client with service role key for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find payment link by token
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('link_id', token)
      .eq('status', 'active')
      .single();

    if (linkError || !paymentLink) {
      return new Response(JSON.stringify({ error: 'Payment link not found or inactive' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Return only necessary data for checkout (no PII)
    const checkoutData = {
      id: paymentLink.id,
      charge_id: paymentLink.order_id,
      amount: paymentLink.amount,
      description: paymentLink.description,
      installments: paymentLink.installments,
      mask_fee: paymentLink.mask_fee,
      // Safe payer data (first name only, masked email/document)
      payer_name: paymentLink.payer_name ? paymentLink.payer_name.split(' ')[0] : 'Cliente',
      payer_email_masked: paymentLink.payer_email ? 
        paymentLink.payer_email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '',
      has_boleto_link: paymentLink.ui_snapshot?.has_boleto_link || false,
      status: paymentLink.status,
      created_at: paymentLink.created_at
    };

    return new Response(JSON.stringify(checkoutData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in public-payment-link function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});