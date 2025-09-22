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

    const url = new URL(req.url);
    let chargeId: string | null = null;
    let action: string | null = null;

    // Try to get chargeId from URL path first
    const pathParts = url.pathname.split('/').filter(part => part);
    const chargeIndex = pathParts.indexOf('charges');
    if (chargeIndex !== -1 && chargeIndex + 1 < pathParts.length) {
      chargeId = pathParts[chargeIndex + 1];
      action = 'payment-link';
    }

    // If not found in path, try to get from request body
    if (!chargeId && req.method === 'POST') {
      try {
        const body = await req.json();
        chargeId = body.chargeId || body.charge_id;
        action = body.action || 'payment-link';
      } catch {
        // Ignore JSON parsing errors
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
    if (req.method === 'GET' || (req.method === 'POST' && action === 'get')) {
      console.log(`Getting payment link for charge ${chargeId}`);

      // Check if charge exists and user has access (RLS will handle this)
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .select('id, amount, payer_name, payer_email, payer_document, payer_phone, description, status')
        .eq('id', chargeId)
        .single();

      if (chargeError) {
        console.error('Error fetching charge:', chargeError);
        return new Response(JSON.stringify({ 
          error: 'Charge not found or access denied' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Look for existing ACTIVE payment link
      const { data: existingLink, error: linkError } = await supabase
        .from('payment_links')
        .select('id, link_id, link_url, guid, status')
        .eq('charge_id', chargeId)
        .eq('status', 'active')
        .maybeSingle();

      if (linkError) {
        console.error('Error fetching payment link:', linkError);
        return new Response(JSON.stringify({ 
          error: 'Error fetching payment link' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!existingLink) {
        return new Response(JSON.stringify({ 
          link: null,
          message: 'No active payment link found' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
      const absoluteUrl = `${baseUrl}/payment?token=${existingLink.guid}`;

      return new Response(JSON.stringify({
        link: {
          id: existingLink.id,
          token: existingLink.guid,
          url: `/payment?token=${existingLink.guid}`,
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
        .single();

      if (chargeError) {
        console.error('Error fetching charge:', chargeError);
        throw new Error('Charge not found or access denied');
      }

      // Check for existing ACTIVE payment link (idempotent)
      const { data: existingLink } = await supabase
        .from('payment_links')
        .select('id, link_id, link_url, guid, status')
        .eq('charge_id', chargeId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingLink) {
        console.log(`Returning existing payment link for charge ${chargeId}`);
        const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
        const absoluteUrl = `${baseUrl}/payment?token=${existingLink.guid}`;

        return new Response(JSON.stringify({
          link: {
            id: existingLink.id,
            token: existingLink.guid,
            url: `/payment?token=${existingLink.guid}`,
            absolute_url: absoluteUrl,
            status: existingLink.status
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate new payment link
      const linkId = `charge_${chargeId}_${Date.now()}`;
      const guid = `${chargeId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const baseUrl = Deno.env.get('BASE_URL') || 'http://localhost:3000';
      const linkUrl = `/payment?token=${guid}`;
      const absoluteUrl = `${baseUrl}${linkUrl}`;

      const { data: newLink, error: insertError } = await supabase
        .from('payment_links')
        .insert({
          link_id: linkId,
          link_url: linkUrl,
          guid: guid,
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
          order_type: 'credit_card',
          ui_snapshot: {
            charge_id: chargeId,
            created_via: 'charge_history'
          }
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating payment link:', insertError);
        throw insertError;
      }

      console.log(`Created new payment link for charge ${chargeId}`);

      return new Response(JSON.stringify({
        link: {
          id: newLink.id,
          token: newLink.guid,
          url: linkUrl,
          absolute_url: absoluteUrl,
          status: newLink.status
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
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