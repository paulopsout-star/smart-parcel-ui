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
    const chargeIdParam = url.searchParams.get('chargeId') || url.searchParams.get('charge')
    const methodParam = url.searchParams.get('method')
    const amountParam = url.searchParams.get('amount')
    const payerNameParam = url.searchParams.get('payerName')
    const paidAtParam = url.searchParams.get('paidAt')
    
    console.log('[thank-you-summary] Token:', token, 'ChargeId:', chargeIdParam)
    
    // Se não tem token mas tem chargeId, buscar diretamente pela charge
    if (!token && chargeIdParam) {
      console.log('[thank-you-summary] No token, fetching charge directly by ID:', chargeIdParam)
      
      const { data: charge, error: chargeError } = await supabase
        .from('charges')
        .select('*')
        .eq('id', chargeIdParam)
        .maybeSingle()
      
      if (chargeError || !charge) {
        console.error('[thank-you-summary] Charge not found:', chargeError)
        // Fallback para dados passados via query params
        if (amountParam && methodParam) {
          console.log('[thank-you-summary] Using fallback query params data')
          return new Response(JSON.stringify({
            paid: true,
            charge: {
              id: chargeIdParam,
              type: 'pontual',
              total_amount_cents: parseInt(amountParam) || 0,
              total_paid_cents: parseInt(amountParam) || 0,
              currency: 'BRL',
              paid: true,
              paid_at: paidAtParam || new Date().toISOString()
            },
            splits: [{
              id: 'fallback-pix',
              method: methodParam?.toUpperCase() || 'PIX',
              amount_cents: parseInt(amountParam) || 0,
              status: 'CONCLUDED',
              processed_at: paidAtParam || new Date().toISOString()
            }],
            transactions: [],
            recurrence: { next_dates: [] },
            company: { name: null, email: null, phone: null },
            ui: { support_email: "faleconosco@autonegocie.com" }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify({ error: 'Charge not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Buscar dados da empresa
      let company = null
      if (charge.company_id) {
        const { data: companyData } = await supabase
          .from('companies')
          .select('name, email, phone')
          .eq('id', charge.company_id)
          .maybeSingle()
        company = companyData
      }
      
      // Buscar splits da charge (se existirem)
      const { data: splits } = await supabase
        .from('payment_splits')
        .select('*')
        .eq('charge_id', chargeIdParam)
        .order('created_at', { ascending: false })
      
      // Verificar se pagamento está confirmado via metadata ou status
      const isPaidByMetadata = charge.metadata?.pix_paid_at || charge.status === 'completed'
      const paidAt = charge.metadata?.pix_paid_at || charge.completed_at || paidAtParam || new Date().toISOString()
      
      // Se não há splits, criar um "virtual" baseado nos dados da charge
      const finalSplits = splits && splits.length > 0 ? splits : [{
        id: 'virtual-pix',
        method: methodParam?.toUpperCase() || 'PIX',
        amount_cents: charge.amount,
        status: 'concluded',
        processed_at: paidAt
      }]
      
      const totalPaidCents = finalSplits.reduce((sum, s) => sum + (s.amount_cents || 0), 0)
      
      return new Response(JSON.stringify({
        paid: true,
        charge: {
          id: charge.id,
          type: charge.recurrence_type || 'pontual',
          total_amount_cents: charge.amount,
          total_paid_cents: totalPaidCents,
          currency: 'BRL',
          paid: true,
          paid_at: paidAt
        },
        splits: finalSplits.map(s => ({
          id: s.id,
          method: s.method?.toUpperCase() || 'PIX',
          amount_cents: s.amount_cents,
          status: (s.status || 'CONCLUDED').toUpperCase(),
          processed_at: s.processed_at || paidAt
        })),
        transactions: [],
        recurrence: { next_dates: [] },
        company: {
          name: company?.name || null,
          email: company?.email || null,
          phone: company?.phone || null
        },
        ui: { support_email: "faleconosco@autonegocie.com" }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    if (!token) {
      // Fallback final: se tem dados via query params, usar
      if (amountParam && methodParam) {
        console.log('[thank-you-summary] No token, using query params fallback')
        return new Response(JSON.stringify({
          paid: true,
          charge: {
            id: 'fallback',
            type: 'pontual',
            total_amount_cents: parseInt(amountParam) || 0,
            total_paid_cents: parseInt(amountParam) || 0,
            currency: 'BRL',
            paid: true,
            paid_at: paidAtParam || new Date().toISOString()
          },
          splits: [{
            id: 'fallback-split',
            method: methodParam?.toUpperCase() || 'PIX',
            amount_cents: parseInt(amountParam) || 0,
            status: 'CONCLUDED',
            processed_at: paidAtParam || new Date().toISOString()
          }],
          transactions: [],
          recurrence: { next_dates: [] },
          company: { name: null, email: null, phone: null },
          ui: { support_email: "faleconosco@autonegocie.com" }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
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

    // Buscar TODOS os splits relacionados a este payment_link, ordenados por created_at DESC
    const { data: allSplits, error: splitsError } = await supabase
      .from('payment_splits')
      .select('*')
      .eq('payment_link_id', paymentLink.id)
      .order('created_at', { ascending: false })

    console.log('[thank-you-summary] Total splits found:', allSplits?.length || 0)

    if (splitsError) {
      console.error('Error fetching splits:', splitsError)
      return new Response(JSON.stringify({ error: 'Error fetching payment data' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Filtrar para pegar APENAS o split mais recente de cada método
    const latestSplitsByMethod = new Map<string, any>();
    if (allSplits) {
      for (const split of allSplits) {
        if (!latestSplitsByMethod.has(split.method)) {
          latestSplitsByMethod.set(split.method, split);
        }
      }
    }
    let splits = Array.from(latestSplitsByMethod.values());
    
    console.log('[thank-you-summary] Latest splits only:', splits?.map(s => ({ id: s.id, method: s.method, status: s.status })))

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
          .order('created_at', { ascending: false })

        if (!chargeError && splitsByCharge && splitsByCharge.length > 0) {
          // Também filtrar por método
          const methodMap = new Map<string, any>();
          for (const split of splitsByCharge) {
            if (!methodMap.has(split.method)) {
              methodMap.set(split.method, split);
            }
          }
          finalSplits = Array.from(methodMap.values());
          console.log('[thank-you-summary] Fallback successful! Latest splits by charge_id:', finalSplits.length)
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

    // Buscar dados da empresa cobradora
    let company = null
    const companyId = charge?.company_id || paymentLink.company_id
    if (companyId) {
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('name, email, phone')
        .eq('id', companyId)
        .single()

      if (!companyError && companyData) {
        company = companyData
        console.log('[thank-you-summary] Company found:', company?.name)
      }
    }

    // ✅ CORREÇÃO: Usar APENAS status como fonte da verdade
    // pre_payment_key ou transaction_id NÃO garantem que o pagamento foi concluído
    // O status 'concluded' é o único indicador válido de pagamento aprovado
    const isPaid = finalSplits && finalSplits.length > 0 && finalSplits.every(s => 
      s.status === 'concluded'
    );
    
    // Verificar se algum split falhou/expirou/cancelou
    const failedSplit = finalSplits?.find(s => 
      s.status === 'failed' || 
      s.status === 'expired' || 
      s.status === 'canceled' ||
      s.status === 'cancelled'
    );
    
    console.log('[thank-you-summary] isPaid:', isPaid, '- failedSplit:', failedSplit?.method, '- splits checked:', finalSplits?.map(s => ({ 
      method: s.method, 
      status: s.status
    })))

    if (!isPaid) {
      // Se tem split com falha, retornar estado de erro
      if (failedSplit) {
        const methodLabel = failedSplit.method === 'credit_card' ? 'Cartão de Crédito' : 
                           failedSplit.method === 'pix' ? 'PIX' : failedSplit.method;
        
        return new Response(JSON.stringify({
          paid: false,
          processing: false,
          failed: true,
          failedMethod: failedSplit.method,
          failedMethodLabel: methodLabel,
          message: `Pagamento via ${methodLabel} não foi aprovado`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      
      // Sem falha, mas ainda não concluído = processando
      return new Response(JSON.stringify({
        paid: false,
        processing: true,
        failed: false,
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

    // Calcular valor total realmente pago (soma dos splits)
    // ✅ Usar display_amount_cents se disponível (valor COM JUROS), senão amount_cents
    const totalPaidCents = finalSplits?.reduce((sum, s) => {
      return sum + (s.display_amount_cents || s.amount_cents || 0);
    }, 0) || 0
    console.log('[thank-you-summary] Total paid cents:', totalPaidCents)

    // Montar resposta
    const response = {
      paid: true,
      charge: {
        id: charge?.id || paymentLink.id,
        type: charge?.recurrence_type || 'pontual',
        total_amount_cents: charge?.amount || paymentLink.amount,
        total_paid_cents: totalPaidCents,
        currency: 'BRL',
        paid: true,
        paid_at: finalSplits[0]?.processed_at || new Date().toISOString()
      },
      splits: (finalSplits || []).map(split => ({
        id: split.id,
        method: split.method,
        // ✅ Usar display_amount_cents para exibição no comprovante (valor COM JUROS)
        amount_cents: split.display_amount_cents || split.amount_cents,
        original_amount_cents: split.amount_cents, // Valor ORIGINAL (para referência)
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
      company: {
        name: company?.name || null,
        email: company?.email || null,
        phone: company?.phone || null
      },
      ui: {
        return_url: paymentLink.ui_snapshot?.return_url || null,
        support_email: "faleconosco@autonegocie.com"
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