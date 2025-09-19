import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Function to mask sensitive data in logs
function maskSensitiveData(obj: any): any {
  if (!obj) return obj
  
  const masked = JSON.parse(JSON.stringify(obj))
  
  // Mask credit card data
  if (masked.CardNumber) masked.CardNumber = '****-****-****-' + (masked.CardNumber.slice(-4) || '****')
  if (masked.CardCvv) masked.CardCvv = '***'
  if (masked.CardExpirationDate) masked.CardExpirationDate = '**/**'
  if (masked.DebtorDocument) masked.DebtorDocument = '***masked***'
  if (masked.DebtorPhoneNumber) masked.DebtorPhoneNumber = '***masked***'
  
  // Mask nested card data
  if (masked.card) {
    if (masked.card.number) masked.card.number = '****-****-****-' + (masked.card.number.slice(-4) || '****')
    if (masked.card.cvv) masked.card.cvv = '***'
    if (masked.card.expirationDate) masked.card.expirationDate = '**/**'
  }
  
  // Mask debtor sensitive data  
  if (masked.debtor) {
    if (masked.debtor.document) masked.debtor.document = '***masked***'
    if (masked.debtor.phoneNumber) masked.debtor.phoneNumber = '***masked***'
  }

  // Mask payer sensitive data
  if (masked.payer) {
    if (masked.payer.document) masked.payer.document = '***masked***'
    if (masked.payer.phoneNumber) masked.payer.phoneNumber = '***masked***'
  }
  
  // Mask in OrderDetails structure
  if (masked.OrderDetails) {
    if (masked.OrderDetails.Debtor) {
      if (masked.OrderDetails.Debtor.Document) masked.OrderDetails.Debtor.Document = '***masked***'
      if (masked.OrderDetails.Debtor.PhoneNumber) masked.OrderDetails.Debtor.PhoneNumber = '***masked***'
    }
    if (masked.OrderDetails.Payer) {
      if (masked.OrderDetails.Payer.Document) masked.OrderDetails.Payer.Document = '***masked***'
      if (masked.OrderDetails.Payer.PhoneNumber) masked.OrderDetails.Payer.PhoneNumber = '***masked***'
    }
  }
  
  return masked
}

async function getAuthToken(supabase: any, maxRetries = 3): Promise<string> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Getting auth token, attempt ${attempt}/${maxRetries}`)
      
      const { data: tokenData, error } = await supabase.functions.invoke('quitaplus-token')
      
      if (error) {
        throw new Error(`Token error: ${error.message}`)
      }
      
      if (!tokenData?.accessToken) {
        throw new Error('Token não recebido')
      }
      
      console.log('Auth token obtained successfully')
      return tokenData.accessToken
      
    } catch (error: any) {
      console.log(`Token request failed on attempt ${attempt}:`, error.message)
      lastError = error
      
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000) // Exponential backoff
      }
    }
  }
  
  throw lastError
}

async function makeProxyRequest(
  accessToken: string,
  targetPath: string,
  httpMethod: string,
  payload?: any,
  maxRetries = 3
): Promise<any> {
  const baseUrl = 'https://api-sandbox.cappta.com.br'
  const url = `${baseUrl}/${targetPath}`
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Making proxy request to ${url}, attempt ${attempt}/${maxRetries}`)
      
      // Create masked version of payload for logging (never log sensitive data)
      const maskedPayload = maskSensitiveData(payload)
      console.log('Request payload (sensitive data masked):', JSON.stringify(maskedPayload, null, 2))
      
      let bodyPayload = payload
      
      // Transform to Quita+ expected schema based on endpoint
      if (httpMethod === 'POST' && payload) {
        const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID') || payload.partner?.merchantId || ''
        
        if (targetPath.startsWith('payment/order/')) {
          // Payment Link creation structure
          // Normalize and validate inputs to avoid empty or invalid values
          const normalizeDigits = (v?: string) => v ? v.replace(/\D/g, '') : undefined

          const merchantIdRaw = Deno.env.get('QUITA_MAIS_MERCHANT_ID') || payload.partner?.merchantId || payload.MerchantId
          const merchantId = normalizeDigits(merchantIdRaw)
          if (!merchantId) {
            throw { status: 400, message: 'Missing required MerchantId (configure QUITA_MAIS_MERCHANT_ID secret or pass it in payload.partner.merchantId)' }
          }

          const creditorDocument = normalizeDigits(payload.partner?.creditorDocument || Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || undefined)
          const creditorName = payload.partner?.creditorName || Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || undefined

          // Build Debtor/BankSlip/Link
          const payer = (payload.payer || payload.debtor) ? {
            Name: (payload.payer || payload.debtor).name,
            Email: (payload.payer || payload.debtor).email,
            PhoneNumber: normalizeDigits((payload.payer || payload.debtor).phoneNumber),
            Document: normalizeDigits((payload.payer || payload.debtor).document),
          } : undefined

          const bankSlip = payload.bankSlip ? {
            Number: payload.bankSlip.number,
            CreditorDocument: normalizeDigits(payload.bankSlip.creditorDocument),
            CreditorName: payload.bankSlip.creditorName,
          } : undefined

          // Flatten link fields into OrderDetails, API expects them at this level
          const amount = payload.link?.amount ?? payload.amount ?? 0
          const description = payload.link?.description ?? payload.description ?? 'Payment Link'
          // Generate simple numeric OrderId to avoid validation issues
          const orderId = payload.link?.orderId ?? payload.orderId ?? Date.now().toString()
          const installments = payload.link?.installments ?? payload.installments
          const maskFee = payload.link?.maskFee ?? payload.maskFee

          // Compute required ExpiresAt (ISO8601). Default to +7 days if not provided
          const expiresAt: string = (() => {
            const raw = payload.link?.expirationDate
            const date = raw ? new Date(raw) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            return date.toISOString()
          })()

          // According to API errors, required fields belong at OrderDetails root
          const orderDetails: any = { 
            MerchantId: merchantId, 
            ExpiresAt: expiresAt,
            Description: description,
            Amount: amount,
          }
          if (creditorDocument) orderDetails.CreditorDocument = creditorDocument
          if (creditorName) orderDetails.CreditorName = creditorName
          if (bankSlip) orderDetails.BankSlip = bankSlip
          if (payer) orderDetails.Payer = payer
          // Only add OrderId if explicitly provided (avoid validation issues)
          if (payload.link?.orderId || payload.orderId) {
            orderDetails.OrderId = payload.link?.orderId ?? payload.orderId
          }
          if (installments != null) orderDetails.Installments = installments
          if (maskFee != null) orderDetails.MaskFee = maskFee

          const basePayload: any = {
            OrderDetails: orderDetails,
            OrderType: payload.orderType || 1,
          }

          bodyPayload = basePayload
        } else if (targetPath.startsWith('prepayment')) {
          // Pre-payment authorization structure  
          if (!merchantId) {
            throw { status: 400, message: 'Missing required MerchantId for prepayment (configure QUITA_MAIS_MERCHANT_ID secret)' }
          }

          bodyPayload = {
            MerchantId: merchantId,
            CreditorDocument: payload.partner?.creditorDocument || Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '',
            CreditorName: payload.partner?.creditorName || Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || 'Credor',
            Amount: payload.transaction?.amount || 0,
            Installments: payload.transaction?.installments || 1,
            DebtorDocument: payload.debtor?.document || '',
            DebtorEmail: payload.debtor?.email || '',
            DebtorPhoneNumber: payload.debtor?.phoneNumber || '',
            DebtorName: payload.debtor?.name || '',
            CardHolderName: payload.card?.holderName || '',
            CardNumber: payload.card?.number || '',
            CardExpirationDate: payload.card?.expirationDate || '',
            CardCvv: payload.card?.cvv || '',
          }
        }

        console.log('Transformed payload (sensitive data masked):', JSON.stringify(maskSensitiveData(bodyPayload), null, 2))
      }
      
      const requestOptions: RequestInit = {
        method: httpMethod,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
      
      if (bodyPayload && (httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH')) {
        requestOptions.body = JSON.stringify(bodyPayload)
      }
      
      const response = await fetch(url, requestOptions)
      
      console.log(`Response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Proxy request successful:', data)
        return data
      }
      
      // Get response body for debugging
      const errorText = await response.text()
      console.log(`Response error (${response.status}):`, errorText)
      
      // Handle rate limiting and server errors with retry
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('retry-after')
        const backoffMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
        
        console.log(`Request failed with ${response.status}, retrying in ${backoffMs}ms`)
        
        if (attempt < maxRetries) {
          await sleep(backoffMs)
          continue
        }
      }
      
      // For other errors, prepare to return error
      lastError = {
        status: response.status,
        message: errorText,
        attempt
      }
      
      if (response.status < 500) {
        // Client errors (4xx) - don't retry
        break
      }
      
    } catch (error: any) {
      console.log(`Network error on attempt ${attempt}:`, error.message)
      lastError = {
        error: error.message,
        attempt
      }
      
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000)
      }
    }
  }
  
  throw lastError
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
    const { targetPath, httpMethod, payload } = await req.json()
    
    if (!targetPath) {
      return new Response(
        JSON.stringify({ error: 'targetPath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!httpMethod) {
      return new Response(
        JSON.stringify({ error: 'httpMethod is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('Proxy request:', { targetPath, httpMethod })
    
    // Initialize Supabase client for calling other edge functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get authentication token
    const accessToken = await getAuthToken(supabase)
    
    // Make proxied request to QuitaPlus API
    const result = await makeProxyRequest(accessToken, targetPath, httpMethod, payload)
    
    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error in quitaplus-proxy:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Proxy request failed', 
        details: error.message || 'Request failed',
        status: error.status || 500,
        lastAttempt: error.attempt || 1
      }),
      { 
        status: error.status || 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})