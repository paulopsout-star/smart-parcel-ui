import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentRequestBody {
  payerName: string;
  payerDocument: string;
  payerEmail: string;
  payerPhoneNumber: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpirationDate: string;
  cardCvv: string;
  amountInCents: number;
  installments: number;
}

interface QuitaMaisRequest {
  merchantId: string;
  creditorName: string;
  creditorDocument: string;
  amountInCents: number;
  installments: number;
  payerDocument: string;
  payerEmail: string;
  payerPhoneNumber: string;
  payerName: string;
  cardHolderName: string;
  cardNumber: string;
  cardExpirationDate: string;
  cardCvv: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Get payment data from request
    const paymentData: PaymentRequestBody = await req.json()

    // Get QuitaMais credentials from Supabase secrets
    const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID')
    const creditorName = Deno.env.get('QUITA_MAIS_CREDITOR_NAME')
    const creditorDocument = Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT')
    const apiUrl = 'https://api-sandbox.cappta.com.br'

    if (!merchantId || !creditorName || !creditorDocument) {
      throw new Error('QuitaMais credentials not configured')
    }

    // Format card expiration date to yyyy/mm format
    const [month, year] = paymentData.cardExpirationDate.split('/')
    const formattedExpirationDate = `20${year}/${month.padStart(2, '0')}`

    // Prepare QuitaMais request
    const quitaMaisRequest: QuitaMaisRequest = {
      merchantId,
      creditorName,
      creditorDocument,
      amountInCents: paymentData.amountInCents,
      installments: paymentData.installments,
      payerDocument: paymentData.payerDocument.replace(/\D/g, ''),
      payerEmail: paymentData.payerEmail,
      payerPhoneNumber: paymentData.payerPhoneNumber.replace(/\D/g, ''),
      payerName: paymentData.payerName,
      cardHolderName: paymentData.cardHolderName,
      cardNumber: paymentData.cardNumber.replace(/\s/g, ''),
      cardExpirationDate: formattedExpirationDate,
      cardCvv: paymentData.cardCvv,
    }

    console.log('Processing payment request:', {
      amount: paymentData.amountInCents,
      installments: paymentData.installments,
      payerEmail: paymentData.payerEmail,
    })

    // Call QuitaMais API
    const response = await fetch(`${apiUrl}/prepayment/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(quitaMaisRequest),
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('QuitaMais API error:', responseData)
      throw new Error(responseData.message || 'Payment processing failed')
    }

    // Generate transaction ID (use QuitaMais response or generate one)
    const transactionId = responseData.transactionId || 
                         responseData.id || 
                         `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Store transaction in database
    const { error: dbError } = await supabaseClient
      .from('transactions')
      .insert([
        {
          transaction_id: transactionId,
          merchant_id: merchantId,
          creditor_name: creditorName,
          creditor_document: creditorDocument,
          amount_in_cents: paymentData.amountInCents,
          installments: paymentData.installments,
          payer_document: paymentData.payerDocument,
          payer_email: paymentData.payerEmail,
          payer_phone_number: paymentData.payerPhoneNumber,
          payer_name: paymentData.payerName,
          card_holder_name: paymentData.cardHolderName,
          card_number_last_four: paymentData.cardNumber.replace(/\s/g, '').slice(-4),
          status: 'AUTHORIZED',
          authorization_code: responseData.authorizationCode,
        }
      ])

    if (dbError) {
      console.error('Database error:', dbError)
      // Continue even if DB insert fails, as payment was authorized
    }

    return new Response(
      JSON.stringify({
        success: true,
        transactionId,
        status: 'AUTHORIZED',
        message: 'Pagamento autorizado com sucesso',
        authorizationCode: responseData.authorizationCode,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Payment processing error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Erro interno do servidor',
        errorDetails: {
          code: 'PAYMENT_ERROR',
          message: error.message,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})