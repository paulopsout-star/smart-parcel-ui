import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[conclude-card-payment] Starting payment conclusion process');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { payment_link_id, amount_cents, installments = 1, transaction_id } = await req.json();

    if (!payment_link_id) {
      console.error('[conclude-card-payment] Missing payment_link_id');
      return new Response(
        JSON.stringify({ error: 'payment_link_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[conclude-card-payment] Processing payment_link_id:', payment_link_id);

    // Fetch payment link
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', payment_link_id)
      .single();

    if (linkError || !paymentLink) {
      console.error('[conclude-card-payment] Payment link not found:', linkError);
      return new Response(
        JSON.stringify({ error: 'Payment link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[conclude-card-payment] Payment link found:', paymentLink.id);

    const totalAmount = amount_cents || paymentLink.amount;
    const chargeId = paymentLink.charge_id;

    console.log('[conclude-card-payment] Total amount:', totalAmount, 'Charge ID:', chargeId);

    // Check for existing credit_card split
    const { data: existingSplits } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_link_id', payment_link_id)
      .eq('method', 'credit_card');

    let splitId: string;

    if (existingSplits && existingSplits.length > 0) {
      // Update existing split
      splitId = existingSplits[0].id;
      console.log('[conclude-card-payment] Updating existing split:', splitId);

      const { error: updateError } = await supabase
        .from('payment_splits')
        .update({
          status: 'concluded',
          transaction_id: transaction_id,
          processed_at: new Date().toISOString(),
          amount_cents: totalAmount,
          installments: installments,
        })
        .eq('id', splitId);

      if (updateError) {
        console.error('[conclude-card-payment] Error updating split:', updateError);
        throw updateError;
      }
    } else {
      // Create new split
      console.log('[conclude-card-payment] Creating new credit_card split');

      const { data: newSplit, error: insertError } = await supabase
        .from('payment_splits')
        .insert({
          payment_link_id: payment_link_id,
          charge_id: chargeId,
          method: 'credit_card',
          amount_cents: totalAmount,
          status: 'pending',
          installments: installments,
          order_index: 1,
        })
        .select()
        .single();

      if (insertError || !newSplit) {
        console.error('[conclude-card-payment] Error creating split:', insertError);
        throw insertError;
      }

      splitId = newSplit.id;
      console.log('[conclude-card-payment] Split created:', splitId);

      // Now update to concluded
      const { error: updateError } = await supabase
        .from('payment_splits')
        .update({
          status: 'concluded',
          transaction_id: transaction_id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', splitId);

      if (updateError) {
        console.error('[conclude-card-payment] Error concluding split:', updateError);
        throw updateError;
      }
    }

    console.log('[conclude-card-payment] Split concluded successfully:', splitId);

    // Remove any pending PIX splits for this payment_link (cleanup)
    const { error: deleteError } = await supabase
      .from('payment_splits')
      .delete()
      .eq('payment_link_id', payment_link_id)
      .eq('method', 'pix')
      .eq('status', 'pending');

    if (deleteError) {
      console.warn('[conclude-card-payment] Could not delete pending PIX splits:', deleteError);
    } else {
      console.log('[conclude-card-payment] Cleaned up any pending PIX splits');
    }

    // Optionally update charge status if all splits are concluded
    if (chargeId) {
      const { data: allSplits } = await supabase
        .from('payment_splits')
        .select('status')
        .eq('charge_id', chargeId);

      if (allSplits && allSplits.every(s => s.status === 'concluded')) {
        console.log('[conclude-card-payment] All splits concluded, updating charge status');
        await supabase
          .from('charges')
          .update({ status: 'completed' })
          .eq('id', chargeId);
      }
    }

    console.log('[conclude-card-payment] Payment conclusion completed successfully');

    return new Response(
      JSON.stringify({ ok: true, splitId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[conclude-card-payment] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
