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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Não autorizado')
    }

    // Criar cliente com token do usuário para verificar permissões
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado')
    }

    // Verificar se usuário é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (roleData?.role !== 'admin') {
      throw new Error('Apenas administradores podem criar usuários')
    }

    const { email, password, full_name, company_id, role } = await req.json()

    // Validações
    if (!email || !password || !full_name || !company_id || !role) {
      throw new Error('Todos os campos são obrigatórios')
    }

    if (password.length < 6) {
      throw new Error('A senha deve ter no mínimo 6 caracteres')
    }

    if (!['admin', 'operador'].includes(role)) {
      throw new Error('Role inválida')
    }

    console.log('Criando usuário:', { email, full_name, company_id, role })

    // Criar usuário no Auth
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    })

    if (createError) {
      console.error('Erro ao criar usuário:', createError)
      throw createError
    }

    console.log('Usuário criado no Auth:', userData.user.id)

    // Criar profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userData.user.id,
        full_name,
        company_id,
        is_active: true
      })

    if (profileError) {
      console.error('Erro ao criar profile:', profileError)
      // Tentar deletar o usuário criado
      await supabase.auth.admin.deleteUser(userData.user.id)
      throw new Error('Erro ao criar perfil do usuário')
    }

    console.log('Profile criado')

    // Criar role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: userData.user.id,
        role
      })

    if (roleError) {
      console.error('Erro ao criar role:', roleError)
      // Tentar deletar profile e usuário
      await supabase.from('profiles').delete().eq('id', userData.user.id)
      await supabase.auth.admin.deleteUser(userData.user.id)
      throw new Error('Erro ao atribuir função ao usuário')
    }

    console.log('Role criada:', role)

    return new Response(JSON.stringify({
      success: true,
      user_id: userData.user.id,
      message: 'Usuário criado com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Erro na função create-user-admin:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
