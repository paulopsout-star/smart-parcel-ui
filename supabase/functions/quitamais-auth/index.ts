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
    // Get environment variables and normalize BASE_URL to origin only (no path)
    const rawBaseUrl = Deno.env.get('BASE_URL') || 'https://api-sandbox.cappta.com.br'
    const clientId = Deno.env.get('QUITA_MAIS_CLIENT_ID')
    const clientSecret = Deno.env.get('QUITA_MAIS_CLIENT_SECRET')

    let baseUrl = rawBaseUrl
    try {
      const parsed = new URL(rawBaseUrl.includes('://') ? rawBaseUrl : `https://${rawBaseUrl}`)
      baseUrl = `${parsed.protocol}//${parsed.host}` // strip any path/query
    } catch (_e) {
      baseUrl = 'https://api-sandbox.cappta.com.br'
    }

    console.log('Environment check:', {
      rawBaseUrl,
      normalizedBaseUrl: baseUrl,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });

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

    console.log('Requesting QuitaMais token from:', `${baseUrl}/connect/token`)

    // Try different common endpoints for OAuth token
    const endpoints = ['/connect/token', '/oauth/token', '/auth/token', '/token', '/identity/connect/token', '/oauth2/token'];
    let tokenRequest;
    let lastError;

    for (const endpoint of endpoints) {
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log(`Trying endpoint: ${fullUrl}`);
      
      try {
        tokenRequest = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
          }),
        });

        console.log(`Response status for ${endpoint}:`, tokenRequest.status);
        
        if (tokenRequest.ok) {
          console.log(`Success with endpoint: ${endpoint}`);
          break;
        } else {
          const errorText = await tokenRequest.text();
          console.log(`Failed ${endpoint} (${tokenRequest.status}):`, errorText);
          lastError = { status: tokenRequest.status, text: errorText, endpoint };
        }
      } catch (fetchError) {
        console.log(`Network error for ${endpoint}:`, fetchError.message);
        lastError = { error: fetchError.message, endpoint };
      }
    }

    if (!tokenRequest || !tokenRequest.ok) {
      console.error('All endpoints failed. Last error:', lastError);
      
      return new Response(
        JSON.stringify({ 
          error: 'Authentication failed', 
          details: `All endpoints failed. Last status: ${lastError?.status || 'Network Error'}`,
          message: lastError?.text || lastError?.error || 'All authentication endpoints returned errors',
          testedEndpoints: endpoints.map(ep => `${baseUrl}${ep}`)
        }),
        { 
          status: lastError?.status || 500, 
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