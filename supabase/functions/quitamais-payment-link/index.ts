import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const { accessToken, paymentData } = await req.json()

    if (!accessToken || !paymentData) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get environment variables
    const baseUrl = Deno.env.get('BASE_URL') || 'https://api-sandbox.cappta.com.br'
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    console.log('Creating payment link with QuitaMais API...')

    // Create payment link with QuitaMais API
    const orderType = paymentData.orderType || 'credit_card'
    const createResponse = await fetch(`${baseUrl}/payment/order/${orderType}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: paymentData.amount,
        payer: paymentData.payer,
        bankslip: paymentData.bankslip,
        checkout: paymentData.checkout,
        description: paymentData.description,
        orderId: paymentData.orderId,
        expirationDate: paymentData.expirationDate,
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('QuitaMais payment link creation failed:', createResponse.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Payment link creation failed', 
          details: `QuitaMais API returned ${createResponse.status}`,
          message: errorText 
        }),
        { 
          status: createResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const paymentLink = await createResponse.json()
    console.log('Payment link created successfully:', paymentLink)

    let linkUrl = paymentLink.linkUrl || paymentLink.url

    // If no URL in response, fetch it using the link search endpoint
    if (!linkUrl && paymentLink.linkId) {
      console.log('Fetching payment link URL...')
      const searchResponse = await fetch(`${baseUrl}/payment/link/search/${paymentLink.linkId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        linkUrl = searchData.linkUrl || searchData.url
      }
    }

    // Save to database
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { data: savedLink, error: dbError } = await supabase
      .from('payment_links')
      .insert({
        link_id: paymentLink.linkId || paymentLink.id,
        link_url: linkUrl,
        guid: paymentLink.guid || paymentLink.linkId,
        amount: paymentData.amount,
        payer_name: paymentData.payer.name,
        payer_email: paymentData.payer.email,
        payer_phone_number: paymentData.payer.phoneNumber,
        payer_document: paymentData.payer.document,
        creditor_name: paymentData.bankslip?.creditorName,
        creditor_document: paymentData.bankslip?.creditorDocument,
        status: paymentLink.status || 'active',
        order_type: orderType,
        description: paymentData.description,
        order_id: paymentData.orderId,
        installments: paymentData.checkout.installments,
        mask_fee: paymentData.checkout.maskFee,
        expiration_date: paymentData.expirationDate,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Still return success since the payment link was created
    }

    return new Response(
      JSON.stringify({
        linkId: paymentLink.linkId || paymentLink.id,
        linkUrl: linkUrl,
        guid: paymentLink.guid || paymentLink.linkId,
        status: paymentLink.status || 'active',
        createdAt: paymentLink.createdAt || new Date().toISOString(),
        savedToDb: !dbError
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error creating payment link:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})