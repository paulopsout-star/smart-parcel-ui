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

async function makeApiRequest(
  accessToken: string,
  endpoint: string,
  method: string,
  payload: any,
  maxRetries = 3
): Promise<any> {
  const baseUrl = 'https://api-sandbox.cappta.com.br'
  const url = `${baseUrl}/${endpoint}`
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Making API request to ${url}, attempt ${attempt}/${maxRetries}`)
      
      const requestOptions: RequestInit = {
        method: method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
      
      if (payload && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestOptions.body = JSON.stringify(payload)
      }
      
      const response = await fetch(url, requestOptions)
      
      console.log(`Response status: ${response.status}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API request successful:', data)
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
    // Receive UI data directly (no targetPath, httpMethod, payload wrappers)
    const uiData = await req.json()
    
    console.log('Processing UI data:', JSON.stringify(maskSensitiveData(uiData), null, 2))
    
    // Initialize Supabase client for calling other edge functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get authentication token
    const accessToken = await getAuthToken(supabase)
    
    // Build orderDetails object following API documentation
    const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID')
    if (!merchantId) {
      throw { status: 400, message: 'Missing required QUITA_MAIS_MERCHANT_ID secret' }
    }

    const orderDetails: any = {
      merchantId: merchantId
    }

    // Add required ExpiresAt field
    if (uiData.link?.expirationDate) {
      const date = new Date(uiData.link.expirationDate)
      orderDetails.expiresAt = date.toISOString().slice(0, 19).replace('T', ' ')
    } else {
      // Default to 30 days from now
      const defaultExpiration = new Date()
      defaultExpiration.setDate(defaultExpiration.getDate() + 30)
      orderDetails.expiresAt = defaultExpiration.toISOString().slice(0, 19).replace('T', ' ')
    }

    // Add optional fields if provided
    if (uiData.link?.description) {
      orderDetails.description = uiData.link.description
    }

    if (uiData.link?.details) {
      orderDetails.details = uiData.link.details
    }

    if (uiData.link?.initiatorKey) {
      orderDetails.initiatorKey = uiData.link.initiatorKey
    }

    // Map debtor → payer
    if (uiData.debtor) {
      orderDetails.payer = {
        document: uiData.debtor.document,
        email: uiData.debtor.email,
        phoneNumber: uiData.debtor.phoneNumber,
        name: uiData.debtor.name
      }
    }

    // Map bankSlip → bankslip
    if (uiData.bankSlip) {
      orderDetails.bankslip = {
        number: uiData.bankSlip.number,
        creditorDocument: uiData.bankSlip.creditorDocument,
        creditorName: uiData.bankSlip.creditorName
      }
    }

    // Map link.maskFee/installments → checkout.maskFee/installments
    if (uiData.link) {
      orderDetails.checkout = {}
      if (uiData.link.maskFee !== undefined) {
        orderDetails.checkout.maskFee = uiData.link.maskFee
      }
      // Always set installments to null per API documentation
      orderDetails.checkout.installments = null
    }

    // Final payload with only orderDetails
    const apiPayload = { orderDetails }
    
    console.log('Sending to API:', JSON.stringify(maskSensitiveData(apiPayload), null, 2))
    
    // Make request to QuitaPlus API
    const result = await makeApiRequest(accessToken, 'payment/order', 'POST', apiPayload)
    
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