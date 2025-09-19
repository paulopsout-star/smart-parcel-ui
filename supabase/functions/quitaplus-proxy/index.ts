import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

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
      console.log('Request payload:', JSON.stringify(payload, null, 2))
      
      // Enhance payload with environment variables for QuitaMais API structure
      if (httpMethod === 'POST' && targetPath === 'payment/order/1' && payload) {
        payload = {
          ...payload,
          partner: {
            ...payload.partner,
            merchantId: Deno.env.get('QUITA_MAIS_MERCHANT_ID') || payload.partner?.merchantId || 'DEFAULT_MERCHANT',
            creditorDocument: payload.partner?.creditorDocument || Deno.env.get('QUITA_MAIS_CREDITOR_DOCUMENT') || '',
            creditorName: payload.partner?.creditorName || Deno.env.get('QUITA_MAIS_CREDITOR_NAME') || 'Credor'
          }
        }
        console.log('Enhanced payload:', JSON.stringify(payload, null, 2))
      }
      
      const requestOptions: RequestInit = {
        method: httpMethod,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      }
      
      if (payload && (httpMethod === 'POST' || httpMethod === 'PUT' || httpMethod === 'PATCH')) {
        requestOptions.body = JSON.stringify(payload)
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