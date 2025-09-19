import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function getAccessToken(): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data, error } = await supabase.functions.invoke('quitaplus-token', {
    body: {}
  })
  
  if (error) {
    throw new Error(`Failed to get token: ${error.message}`)
  }
  
  if (!data?.accessToken) {
    throw new Error('No access token received')
  }
  
  return data.accessToken
}

async function proxyRequestWithRetry(
  url: string, 
  init: RequestInit, 
  maxRetries = 3
): Promise<Response> {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Proxy request attempt ${attempt}/${maxRetries} to ${url}`)
      
      const response = await fetch(url, init)
      
      // Handle rate limiting (429) and server errors (5xx)
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('retry-after')
        const backoffMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000
        
        console.log(`Request failed with ${response.status}, retrying in ${backoffMs}ms`)
        
        if (attempt < maxRetries) {
          await sleep(backoffMs)
          continue
        }
      }

      // For successful responses or client errors, return immediately
      return response

    } catch (error: any) {
      console.log(`Network error on attempt ${attempt}:`, error.message)
      lastError = error
      
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

  try {
    // Extract the path after /quitaplus/
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/')
    const quitaplusIndex = pathParts.findIndex(part => part === 'quitaplus-proxy')
    
    if (quitaplusIndex === -1 || quitaplusIndex === pathParts.length - 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid proxy path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the target path (everything after /quitaplus-proxy/)
    const targetPath = pathParts.slice(quitaplusIndex + 1).join('/')
    
    // Get base URL from environment
    const baseUrl = Deno.env.get('QUITAPLUS_BASE_URL') || 'https://api-sandbox.cappta.com.br'
    
    // Build target URL
    const targetUrl = `${baseUrl}/${targetPath}${url.search}`
    
    console.log('Proxying request to:', targetUrl)

    // Get access token
    const accessToken = await getAccessToken()
    
    // Prepare headers for the proxied request
    const proxyHeaders = new Headers()
    
    // Copy relevant headers from original request
    const headersToProxy = ['content-type', 'accept', 'user-agent']
    headersToProxy.forEach(headerName => {
      const value = req.headers.get(headerName)
      if (value) {
        proxyHeaders.set(headerName, value)
      }
    })

    // Add authorization header
    proxyHeaders.set('Authorization', `Bearer ${accessToken}`)

    // Prepare request body
    let body: string | FormData | null = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        body = await req.text()
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        body = await req.text()
      } else if (contentType.includes('multipart/form-data')) {
        body = await req.formData()
      } else {
        body = await req.text()
      }
    }

    // Make the proxied request with retry logic
    const proxyResponse = await proxyRequestWithRetry(targetUrl, {
      method: req.method,
      headers: proxyHeaders,
      body: body as any,
    })

    // Prepare response headers
    const responseHeaders = new Headers(corsHeaders)
    
    // Copy response headers (excluding CORS headers that we control)
    const headersToForward = ['content-type', 'cache-control', 'expires', 'last-modified', 'etag']
    headersToForward.forEach(headerName => {
      const value = proxyResponse.headers.get(headerName)
      if (value) {
        responseHeaders.set(headerName, value)
      }
    })

    // Return the proxied response
    const responseBody = await proxyResponse.text()
    
    console.log(`Proxy response: ${proxyResponse.status} for ${targetUrl}`)
    
    return new Response(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    })

  } catch (error: any) {
    console.error('Error in quitaplus-proxy:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Proxy error', 
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})