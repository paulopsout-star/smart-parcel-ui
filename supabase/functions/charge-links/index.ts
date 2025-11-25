import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        }
      }
    );

    let chargeId: string | null = null;
    let action: string | null = null;

    // Get chargeId from request body for POST requests
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        chargeId = body.chargeId || body.charge_id;
        action = body.action || 'get';
      } catch (error) {
        console.error('Error parsing request body:', error);
        return new Response(JSON.stringify({ error: 'Invalid request body' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!chargeId || !chargeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      console.error('Invalid or missing charge ID:', chargeId);
      return new Response(JSON.stringify({ error: 'Valid charge ID is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${req.method} request for charge: ${chargeId}, action: ${action}`);

    // Handle GET requests (get existing payment link)
    if (req.method === 'POST' && action === 'get') {
      console.log(`Getting payment link for charge ${chargeId}`);

      // Check if charge exists and user has access (RLS will handle this)
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .select('id, amount, payer_name, payer_email, payer_document, payer_phone, description, status')
        .eq('id', chargeId)
        .maybeSingle();

      if (chargeError) {
        console.error('Error fetching charge:', chargeError);
        return new Response(JSON.stringify({ 
          code: 'CHARGE_ACCESS_DENIED',
          error: 'Charge not found or access denied' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!charge) {
        return new Response(JSON.stringify({ 
          code: 'CHARGE_NOT_FOUND',
          error: 'Charge not found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Look for existing ACTIVE payment link
      const { data: existingLink, error: linkError } = await supabase
        .from('payment_links')
        .select('id, token, url, status')
        .eq('charge_id', chargeId)
        .eq('status', 'active')
        .maybeSingle();

      if (linkError) {
        console.error('Error fetching payment link:', linkError);
        return new Response(JSON.stringify({ 
          code: 'DB_ERROR',
          error: 'Error fetching payment link' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!existingLink) {
        return new Response(JSON.stringify({ 
          code: 'NOT_FOUND',
          link: null,
          message: 'No active payment link found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate canonical checkout URL
      const origin = Deno.env.get('APP_ORIGIN') 
        || req.headers.get('origin') 
        || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || new URL(req.url).origin;
      const checkoutId = existingLink.id;
      const checkoutUrl = new URL(`/checkout/${checkoutId}`, origin).toString();

      return new Response(JSON.stringify({
        link: {
          id: existingLink.id,
          url: checkoutUrl,
          linkId: checkoutId
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle POST requests (create new payment link)
    if (req.method === 'POST' && action === 'create') {
      console.log(`Creating payment link for charge ${chargeId}`);

      // Subscription check removed - all authenticated users can create payment links

      // Check if charge exists and user has access
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .select('*')
        .eq('id', chargeId)
        .maybeSingle();

      if (chargeError) {
        console.error('Error fetching charge:', chargeError);
        return new Response(JSON.stringify({ 
          code: 'CHARGE_ACCESS_DENIED',
          error: 'Charge not found or access denied' 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!charge) {
        return new Response(JSON.stringify({ 
          code: 'CHARGE_NOT_FOUND',
          error: 'Charge not found' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check for existing ACTIVE payment link (idempotent)
      const { data: existingLink } = await supabase
        .from('payment_links')
        .select('id, token, url, status')
        .eq('charge_id', chargeId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingLink) {
        console.log(`Returning existing payment link for charge ${chargeId}`);
        
        // Generate canonical checkout URL
        const origin = Deno.env.get('APP_ORIGIN') 
          || req.headers.get('origin') 
          || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
          || new URL(req.url).origin;
        const checkoutId = existingLink.id;
        const checkoutUrl = new URL(`/checkout/${checkoutId}`, origin).toString();
        
        // Update charge with checkout URL if not set
        if (!charge.checkout_url || !charge.checkout_link_id) {
          await supabase
            .from('charges')
            .update({
              checkout_url: checkoutUrl,
              checkout_link_id: checkoutId
            })
            .eq('id', chargeId);
        }

        return new Response(JSON.stringify({
          link: {
            id: existingLink.id,
            url: checkoutUrl,
            linkId: checkoutId
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate mock values for required NOT NULL fields
      const tmpLinkId = crypto.randomUUID();
      const tmpGuid = crypto.randomUUID();
      const origin = Deno.env.get('APP_ORIGIN') 
        || req.headers.get('origin') 
        || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
        || new URL(req.url).origin;
      
      // Determine checkout URL based on payment method
      const checkoutPath = charge.payment_method === 'pix' ? `/checkout-pix/${chargeId}` : `/checkout/${tmpLinkId}`;
      const tmpLinkUrl = new URL(checkoutPath, origin).toString();

      // Create new payment link with all required fields
      console.log(`Creating payment link for charge ${chargeId} with company_id: ${charge.company_id}`);
      
      const { data: newLink, error: insertError } = await supabase
        .from('payment_links')
        .insert({
          charge_id: chargeId,
          company_id: charge.company_id,
          amount: charge.amount,
          payer_name: charge.payer_name,
          payer_email: charge.payer_email,
          payer_document: charge.payer_document,
          payer_phone_number: charge.payer_phone,
          description: charge.description,
          installments: charge.installments || 1,
          mask_fee: charge.mask_fee || false,
          status: 'active',
          order_type: 'credit_card',
          link_id: tmpLinkId,
          link_url: tmpLinkUrl,
          guid: tmpGuid,
          creditor_document: charge.creditor_document || null,
          creditor_name: charge.creditor_name || null
        })
        .select('id, token, url, status')
        .single();

      if (insertError) {
        console.error('Error creating payment link:', insertError);
        
        // Log NOT NULL violations for debugging
        if (insertError.code === '23502') {
          console.error('NOT NULL constraint violation:', insertError.message, insertError.details);
        }
        
        // Handle unique constraint violations (race condition)
        if (insertError.code === '23505') {
          const { data: existingAfterRace } = await supabase
            .from('payment_links')
            .select('id, token, url, status')
            .eq('charge_id', chargeId)
            .eq('status', 'active')
            .maybeSingle();
          
          if (existingAfterRace) {
            // Generate canonical checkout URL
            const origin = Deno.env.get('APP_ORIGIN') 
              || req.headers.get('origin') 
              || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
              || new URL(req.url).origin;
            const checkoutId = existingAfterRace.id;
            const checkoutUrl = new URL(`/checkout/${checkoutId}`, origin).toString();
            
            // Update charge with checkout URL and link ID
            await supabase
              .from('charges')
              .update({
                checkout_url: checkoutUrl,
                checkout_link_id: checkoutId
              })
              .eq('id', chargeId);
            
            return new Response(JSON.stringify({
              link: {
                id: existingAfterRace.id,
                url: checkoutUrl,
                linkId: checkoutId
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        return new Response(JSON.stringify({ 
          code: 'CREATE_FAILED',
          error: 'Failed to create payment link' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Created new payment link for charge ${chargeId}`);
      
      // Use the canonical checkout URL based on payment method
      const checkoutId = newLink.id;
      const finalCheckoutPath = charge.payment_method === 'pix' ? `/checkout-pix/${chargeId}` : `/checkout/${checkoutId}`;
      const checkoutUrl = new URL(finalCheckoutPath, origin).toString();
      
      // Update charge with checkout URL and link ID
      await supabase
        .from('charges')
        .update({
          checkout_url: checkoutUrl,
          checkout_link_id: checkoutId
        })
        .eq('id', chargeId);

      return new Response(JSON.stringify({
        link: {
          id: newLink.id,
          url: checkoutUrl,
          linkId: checkoutId
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED' 
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in charge-links function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});