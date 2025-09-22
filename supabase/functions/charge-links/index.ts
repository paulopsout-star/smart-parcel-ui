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

      const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
      const absoluteUrl = `${baseUrl}${existingLink.url}`;

      return new Response(JSON.stringify({
        link: {
          id: existingLink.id,
          token: existingLink.token,
          url: existingLink.url,
          absolute_url: absoluteUrl,
          status: existingLink.status
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle POST requests (create new payment link)
    if (req.method === 'POST' && action === 'create') {
      console.log(`Creating payment link for charge ${chargeId}`);

      // Check subscription status first
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: subscriptionStatus } = await supabase.functions.invoke('subscription-manager', {
          body: { action: 'check_status', company_id: user.id }
        });

        if (!subscriptionStatus?.allowed) {
          return new Response(JSON.stringify({ 
            code: 'SUBSCRIPTION_BLOCKED',
            error: 'Subscription required to generate new payment links' 
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

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
        const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
        const absoluteUrl = `${baseUrl}${existingLink.url}`;

        return new Response(JSON.stringify({
          link: {
            id: existingLink.id,
            token: existingLink.token,
            url: existingLink.url,
            absolute_url: absoluteUrl,
            status: existingLink.status
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create new payment link - trigger will populate token/url
      const { data: newLink, error: insertError } = await supabase
        .from('payment_links')
        .insert({
          charge_id: chargeId,
          amount: charge.amount,
          payer_name: charge.payer_name,
          payer_email: charge.payer_email,
          payer_document: charge.payer_document,
          payer_phone_number: charge.payer_phone,
          description: charge.description,
          installments: charge.installments || 1,
          mask_fee: charge.mask_fee || false,
          status: 'active',
          order_type: 'credit_card'
        })
        .select('id, token, url, status')
        .single();

      if (insertError) {
        console.error('Error creating payment link:', insertError);
        // Handle unique constraint violations (race condition)
        if (insertError.code === '23505') {
          const { data: existingAfterRace } = await supabase
            .from('payment_links')
            .select('id, token, url, status')
            .eq('charge_id', chargeId)
            .eq('status', 'active')
            .maybeSingle();
          
          if (existingAfterRace) {
            const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
            const absoluteUrl = `${baseUrl}${existingAfterRace.url}`;
            
            return new Response(JSON.stringify({
              link: {
                id: existingAfterRace.id,
                token: existingAfterRace.token,
                url: existingAfterRace.url,
                absolute_url: absoluteUrl,
                status: existingAfterRace.status
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
      const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
      const absoluteUrl = `${baseUrl}${newLink.url}`;

      return new Response(JSON.stringify({
        link: {
          id: newLink.id,
          token: newLink.token,
          url: newLink.url,
          absolute_url: absoluteUrl,
          status: newLink.status
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