import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      console.error('[public-payment-splits] Missing id parameter');
      return new Response(
        JSON.stringify({ error: 'Payment link id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-payment-splits] Fetching data for payment_link_id: ${id}`);

    // Use service_role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch payment_link
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', id)
      .single();

    if (linkError) {
      console.error('[public-payment-splits] Error fetching payment_link:', linkError);
      return new Response(
        JSON.stringify({ error: 'Payment link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch payment_splits
    const { data: paymentSplits, error: splitsError } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_link_id', id)
      .order('order_index');

    if (splitsError) {
      console.error('[public-payment-splits] Error fetching payment_splits:', splitsError);
      return new Response(
        JSON.stringify({ error: 'Payment splits not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[public-payment-splits] ✅ Found payment_link and ${paymentSplits?.length || 0} splits`);

    return new Response(
      JSON.stringify({
        payment_link: paymentLink,
        payment_splits: paymentSplits || [],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[public-payment-splits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
