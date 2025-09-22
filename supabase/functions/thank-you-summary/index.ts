import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('pl')
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing payment link token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar payment_link pelo token
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('link_id', token)
      .single()

    if (linkError || !paymentLink) {
      return new Response(JSON.stringify({ error: 'Invalid or expired link' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar cobrança relacionada através do payment_links
    // Primeiro, buscar splits relacionados a este payment_link
    const { data: splits, error: splitsError } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_link_id', paymentLink.id)

    if (splitsError) {
      console.error('Error fetching splits:', splitsError)
      return new Response(JSON.stringify({ error: 'Error fetching payment data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Se não há splits, buscar charge_id diretamente das execuções
    let chargeId = null
    if (splits && splits.length > 0) {
      chargeId = splits[0].charge_id
    } else {
      // Buscar através de charge_executions se disponível
      const { data: executions } = await supabase
        .from('charge_executions')
        .select('charge_id')
        .eq('payment_link_id', paymentLink.id)
        .limit(1)

      if (executions && executions.length > 0) {
        chargeId = executions[0].charge_id
      }
    }

    let charge = null
    if (chargeId) {
      const { data: chargeData, error: chargeError } = await supabase
        .from('charges')
        .select('*')
        .eq('id', chargeId)
        .single()

      if (!chargeError && chargeData) {
        charge = chargeData
      }
    }

    // Verificar se está PAID (todos os splits CONCLUDED)
    const isPaid = splits && splits.length > 0 && splits.every(s => s.status === 'concluded')

    if (!isPaid) {
      return new Response(JSON.stringify({
        paid: false,
        processing: true,
        message: "Pagamento em processamento"
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar transações relacionadas aos splits
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .in('id', splits.map(s => s.transaction_id).filter(Boolean))
      .order('created_at', { ascending: false })

    // Buscar próximas execuções se for recorrente
    let nextDates: string[] = []
    if (charge && charge.recurrence_type !== 'pontual' && chargeId) {
      const { data: executions } = await supabase
        .from('charge_executions')
        .select('scheduled_for')
        .eq('charge_id', chargeId)
        .eq('status', 'SCHEDULED')
        .gt('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(3)

      if (executions) {
        nextDates = executions.map(e => e.scheduled_for).filter(Boolean)
      }
    }

    // Montar resposta
    const response = {
      charge: {
        id: charge?.id || paymentLink.id,
        type: charge?.recurrence_type || 'pontual',
        total_amount_cents: charge?.amount || paymentLink.amount,
        currency: 'BRL',
        paid: true,
        paid_at: new Date().toISOString(), // Usar timestamp atual já que está PAID
        has_boleto_link: charge?.has_boleto_link || false
      },
      splits: (splits || []).map(split => ({
        id: split.id,
        method: split.method,
        amount_cents: split.amount_cents,
        status: split.status.toUpperCase(),
        processed_at: split.processed_at
      })),
      transactions: (transactions || []).map(tx => ({
        id: tx.id,
        created_at: tx.created_at,
        amount_cents: tx.amount_in_cents,
        method: tx.status?.includes('PIX') ? 'PIX' : tx.status?.includes('CARD') ? 'CARD' : 'QUITA',
        transaction_id: tx.transaction_id
      })),
      recurrence: {
        next_dates: nextDates
      },
      ui: {
        return_url: paymentLink.ui_snapshot?.return_url || null,
        support_hint: "Suporte: suporte@empresa.com (mock)"
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error in thank-you-summary:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})