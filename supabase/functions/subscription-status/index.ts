import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubscriptionData {
  status: 'loading' | 'active' | 'canceled' | 'past_due';
  plan?: string;
  ends_at?: string;
  canceled_at?: string;
  orgId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get user from JWT
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const orgId = url.searchParams.get('orgId') || user.id

    // Query subscription from database
    const { data: subscription, error } = await supabaseClient
      .from('subscriptions')
      .select('status, plan_code, current_period_end, canceled_at, grace_days')
      .eq('company_id', orgId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Database error:', error)
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let result: SubscriptionData

    if (!subscription) {
      // No subscription found - default to canceled
      result = {
        status: 'canceled',
        orgId
      }
    } else {
      const now = new Date()
      const endsAt = subscription.current_period_end ? new Date(subscription.current_period_end) : null
      const canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at) : null

      // Apply business rules for active status
      const isActive = ['active', 'trialing'].includes(subscription.status?.toLowerCase() || '') &&
                      (!endsAt || endsAt > now) &&
                      !canceledAt

      let status: 'active' | 'canceled' | 'past_due'
      
      if (isActive) {
        status = 'active'
      } else if (subscription.status?.toLowerCase() === 'past_due') {
        // Check if within grace period
        const graceDays = subscription.grace_days || 7
        const graceEnd = endsAt ? new Date(endsAt.getTime() + (graceDays * 24 * 60 * 60 * 1000)) : null
        status = (graceEnd && now <= graceEnd) ? 'past_due' : 'canceled'
      } else {
        status = 'canceled'
      }

      result = {
        status,
        plan: subscription.plan_code,
        ends_at: subscription.current_period_end,
        canceled_at: subscription.canceled_at,
        orgId
      }
    }

    // Log for telemetry
    console.log(`Subscription status check: ${JSON.stringify({
      orgId,
      userId: user.id,
      status: result.status,
      fetchedAt: new Date().toISOString()
    })}`)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Subscription status error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})