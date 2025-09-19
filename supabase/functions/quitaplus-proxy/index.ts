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
      console.log('Response headers:', JSON.stringify([...response.headers.entries()]))
      
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
    // Receive UI data directly 
    const uiData = await req.json()
    
    console.log('Processing UI data:', JSON.stringify(maskSensitiveData(uiData), null, 2))
    
    // Initialize Supabase client for calling other edge functions
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Get authentication token
    const accessToken = await getAuthToken(supabase)
    
    // Get environment variables
    const merchantId = Deno.env.get('QUITA_MAIS_MERCHANT_ID')
    if (!merchantId) {
      throw { status: 400, message: 'Missing required QUITA_MAIS_MERCHANT_ID secret' }
    }

    // ====== NORMALIZAÇÃO E CONTRATO EXATO QUITA+ ======
    
    // 1. NORMALIZAR orderType obrigatório → NUMÉRICO PARA PATH
    let normalizedOrderType: string
    const rawOrderType = uiData.orderType
    
    if (rawOrderType === "boleto" || rawOrderType === "bankslip" || rawOrderType === "1" || rawOrderType === 1) {
      normalizedOrderType = "1" // Boleto = tipo 1 (numérico exigido no path)
    } else {
      throw { status: 400, message: `orderType inválido: ${rawOrderType}. Valores aceitos: "boleto", "bankslip", "1", 1` }
    }

    // 2. BUILD REQUEST_BODY - SOMENTE campos aceitos pela API
    const REQUEST_BODY: any = {
      orderDetails: {
        merchantId: merchantId
      }
    }

    // Adicionar initiatorKey obrigatório se disponível
    if (uiData.link?.initiatorKey) {
      REQUEST_BODY.orderDetails.initiatorKey = uiData.link.initiatorKey
    }

    // Adicionar expiresAt obrigatório (YYYY-MM-DD HH:mm:ss)
    if (uiData.link?.expirationDate) {
      const date = new Date(uiData.link.expirationDate)
      REQUEST_BODY.orderDetails.expiresAt = date.toISOString().slice(0, 19).replace('T', ' ')
    } else {
      // Default: 30 dias
      const defaultExpiration = new Date()
      defaultExpiration.setDate(defaultExpiration.getDate() + 30)
      REQUEST_BODY.orderDetails.expiresAt = defaultExpiration.toISOString().slice(0, 19).replace('T', ' ')
    }

    // Campos opcionais
    if (uiData.link?.description) {
      REQUEST_BODY.orderDetails.description = uiData.link.description.substring(0, 200) // truncar
    }
    if (uiData.link?.details) {
      REQUEST_BODY.orderDetails.details = uiData.link.details.substring(0, 200) // truncar
    }

    // Mapear debtor → payer (normalizar e truncar)
    if (uiData.debtor) {
      REQUEST_BODY.orderDetails.payer = {
        document: uiData.debtor.document.replace(/\D/g, ''), // somente dígitos
        email: uiData.debtor.email.substring(0, 50), // máx 50 chars
        phoneNumber: uiData.debtor.phoneNumber.replace(/\D/g, '').substring(0, 11), // máx 11 dígitos
        name: uiData.debtor.name.substring(0, 200) // máx 200 chars
      }
    }

    // Mapear bankSlip → bankslip (normalizar)
    if (uiData.bankSlip) {
      REQUEST_BODY.orderDetails.bankslip = {
        number: uiData.bankSlip.number.replace(/\D/g, ''), // somente dígitos
        creditorDocument: uiData.bankSlip.creditorDocument.replace(/\D/g, ''), // somente dígitos
        creditorName: uiData.bankSlip.creditorName.substring(0, 200) // máx 200 chars
      }
    }

    // Mapear link → checkout (installments: vazio/0 → null)
    if (uiData.link) {
      REQUEST_BODY.orderDetails.checkout = {
        maskFee: uiData.link.maskFee || false,
        installments: (uiData.link.installments && uiData.link.installments > 0) ? uiData.link.installments : null
      }
    }

    // 3. BUILD EXTRAS_TO_STORE - dados somente para o banco (NUNCA enviados para API)
    const EXTRAS_TO_STORE = {
      amount: uiData.link?.amount || 0,
      order_type_ui: rawOrderType,
      orderId: uiData.orderId || null,
      ui_snapshot: uiData // snapshot completo da UI
    }
    
    
    console.log('REQUEST_BODY (CONTRATO EXATO):', JSON.stringify(maskSensitiveData(REQUEST_BODY), null, 2))
    console.log('EXTRAS_TO_STORE (SOMENTE DB):', JSON.stringify(maskSensitiveData(EXTRAS_TO_STORE), null, 2))
    console.log('URL FINAL COMPLETA:', `${baseUrl}/payment/order/${normalizedOrderType}`)
    console.log('NORMALIZED ORDER TYPE:', normalizedOrderType)
    
    // Fazer chamada para API Quita+ com URL normalizada e REQUEST_BODY limpo
    const result = await makeApiRequest(accessToken, `payment/order/${normalizedOrderType}`, 'POST', REQUEST_BODY)
    
    // Return result with extras for database storage
    return new Response(
      JSON.stringify({
        ...result,
        _extrasToStore: EXTRAS_TO_STORE
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('Error in quitaplus-proxy:', error)
    
    // Enhanced error response with debug info for 400/404
    const errorResponse: any = { 
      error: 'Proxy request failed', 
      details: error.message || 'Request failed',
      status: error.status || 500,
      lastAttempt: error.attempt || 1
    }
    
    // Add debug info for validation errors (400/404)
    if (error.status === 400 || error.status === 404) {
      errorResponse.debug = {
        url: `${baseUrl}/payment/order/${normalizedOrderType}`,
        orderTypeNormalizado: normalizedOrderType,
        hasOrderDetails: REQUEST_BODY && REQUEST_BODY.orderDetails ? true : false
      }
    }
    
    return new Response(
      JSON.stringify(errorResponse),
      { 
        status: error.status || 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})