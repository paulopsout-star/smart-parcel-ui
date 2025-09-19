import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables
    const baseUrl = Deno.env.get('BASE_URL') || 'https://api-sandbox.cappta.com.br'
    const clientId = Deno.env.get('QUITA_MAIS_CLIENT_ID')
    const clientSecret = Deno.env.get('QUITA_MAIS_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('Missing QuitaMais credentials')
      return new Response(
        JSON.stringify({ 
          error: 'Configuration error', 
          details: 'Missing QuitaMais credentials' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Requesting QuitaMais token...')

    // Request token from QuitaMais API
    const tokenRequest = await fetch(`${baseUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRequest.ok) {
      const errorText = await tokenRequest.text()
      console.error('QuitaMais auth failed:', tokenRequest.status, errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: `QuitaMais API returned ${tokenRequest.status}`,
          message: errorText 
        }),
        { 
          status: tokenRequest.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const tokenData = await tokenRequest.json()
    console.log('QuitaMais token received successfully')

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokenData.expires_in * 1000)

    return new Response(
      JSON.stringify({
        accessToken: tokenData.access_token,
        tokenType: tokenData.token_type || 'Bearer',
        expiresIn: tokenData.expires_in,
        expiresAt
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in QuitaMais auth:', error)
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