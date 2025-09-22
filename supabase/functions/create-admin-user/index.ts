import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role (admin privileges)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('Creating admin user...')

    // Create admin user using Supabase Auth Admin API
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: 'admin@sistema.com',
      password: 'Auto2025@',
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        full_name: 'Administrador do Sistema'
      }
    })

    if (userError) {
      console.error('Error creating user:', userError)
      
      // If user already exists, that's ok
      if (userError.message?.includes('User already registered')) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Admin user already exists',
          userId: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      throw userError
    }

    console.log('User created successfully:', userData.user.id)

    // Update the profile to ensure admin role
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userData.user.id,
        full_name: 'Administrador do Sistema',
        role: 'admin',
        is_active: true
      })

    if (profileError) {
      console.error('Error updating profile:', profileError)
      throw profileError
    }

    console.log('Admin user and profile created successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Admin user created successfully',
      userId: userData.user.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error in create-admin-user function:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})