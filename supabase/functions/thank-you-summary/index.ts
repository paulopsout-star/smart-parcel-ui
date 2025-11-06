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
    
    console.log('[thank-you-summary] Token:', token)
    
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing payment link token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Buscar payment_link pelo id (consistente com public-payment-link)
    const { data: paymentLink, error: linkError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('id', token)
      .single()

    console.log('[thank-you-summary] Payment Link found:', paymentLink?.id)

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

    console.log('[thank-you-summary] Splits found by payment_link_id:', splits?.length || 0)
    console.log('[thank-you-summary] Splits status:', splits?.map(s => ({ id: s.id, method: s.method, status: s.status })))

    if (splitsError) {
      console.error('Error fetching splits:', splitsError)
      return new Response(JSON.stringify({ error: 'Error fetching payment data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Fallback: buscar por charge_id se não houver splits por payment_link_id
    let finalSplits = splits
    let chargeId = paymentLink.charge_id

    if (!finalSplits || finalSplits.length === 0) {
      console.log('[thank-you-summary] No splits by payment_link_id, trying fallback by charge_id:', chargeId)
      
      if (chargeId) {
        const { data: splitsByCharge, error: chargeError } = await supabase
          .from('payment_splits')
          .select('*')
          .eq('charge_id', chargeId)

        if (!chargeError && splitsByCharge && splitsByCharge.length > 0) {
          finalSplits = splitsByCharge
          console.log('[thank-you-summary] Fallback successful! Splits found by charge_id:', finalSplits.length)
        }
      }

      // Se ainda não houver splits, buscar charge_id diretamente das execuções
      if ((!finalSplits || finalSplits.length === 0) && !chargeId) {
        const { data: executions } = await supabase
          .from('charge_executions')
          .select('charge_id')
          .eq('payment_link_id', paymentLink.id)
          .limit(1)

        if (executions && executions.length > 0) {
          chargeId = executions[0].charge_id
          console.log('[thank-you-summary] Found charge_id from executions:', chargeId)
        }
      }
    } else {
      chargeId = finalSplits[0].charge_id || chargeId
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
    const isPaid = finalSplits && finalSplits.length > 0 && finalSplits.every(s => s.status === 'concluded')
    
    console.log('[thank-you-summary] isPaid:', isPaid)

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
      .in('id', finalSplits.map(s => s.transaction_id).filter(Boolean))
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
      splits: (finalSplits || []).map(split => ({
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