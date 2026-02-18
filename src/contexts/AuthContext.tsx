import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'operador';
  is_active: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  isAdmin: boolean;
  isOperador: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('🔍 [AuthContext] Iniciando fetchProfile para:', userId);
      
      // 1. Buscar profile (SEM role - vem de user_roles)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, is_active, company_id, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ [AuthContext] Erro ao buscar profile:', profileError);
        console.error('❌ [AuthContext] Detalhes do erro:', {
          message: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        });
        return null;
      }
      
      if (!profileData) {
        console.error('❌ [AuthContext] Profile data está vazio/null');
        return null;
      }

      console.log('✅ [AuthContext] Profile carregado:', {
        id: profileData.id,
        name: profileData.full_name,
        company_id: profileData.company_id,
        is_active: profileData.is_active
      });

      // 2. Buscar role da tabela user_roles (fonte única de verdade)
      console.log('🔍 [AuthContext] Buscando role em user_roles...');
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('⚠️ [AuthContext] Erro ao buscar role (usando default):', roleError);
      }

      const role = roleData?.role || 'operador';
      
      console.log('✅ [AuthContext] Role determinada:', {
        role: role,
        from_db: !!roleData,
        is_admin: role === 'admin',
        is_operador: role === 'operador'
      });

      const profile: Profile = {
        ...profileData,
        role,
      };

      console.log('✅ [AuthContext] Profile completo montado:', profile);
      return profile;
    } catch (error) {
      console.error('❌ [AuthContext] Erro inesperado em fetchProfile:', error);
      return null;
    }
  };

  const clearLocalStorage = () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
  };

  useEffect(() => {
    // ÚNICO ponto de inicialização: onAuthStateChange
    // O evento INITIAL_SESSION valida o token com o servidor antes de disparar.
    // Se o token for inválido, dispara SIGNED_OUT automaticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AuthContext] event:', event, '| session:', session?.user?.id ?? 'null');

        if (event === 'SIGNED_OUT' || !session) {
          clearLocalStorage();
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        if (
          event === 'SIGNED_IN' ||
          event === 'TOKEN_REFRESHED' ||
          event === 'INITIAL_SESSION' ||
          event === 'USER_UPDATED'
        ) {
          setSession(session);
          setUser(session.user);
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error };
  };

  const signOut = async () => {
    // Limpar localStorage ANTES do signOut para evitar race condition
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('[AuthContext] signOut com erro (esperado se sessão já expirou):', error.message);
    }

    // Sempre limpar estado React
    setUser(null);
    setSession(null);
    setProfile(null);

    return { error };
  };

  const isAdmin = profile?.role === 'admin' && profile?.is_active;
  const isOperador = (profile?.role === 'operador' || profile?.role === 'admin') && profile?.is_active;

  // Debug logging detalhado
  console.log('🔍 [AuthContext Render] Estado atual:', {
    user_id: user?.id || 'null',
    profile_id: profile?.id || 'null',
    profile_name: profile?.full_name || 'null',
    profile_role: profile?.role || 'null',
    profile_is_active: profile?.is_active ?? 'null',
    isAdmin,
    isOperador,
    loading
  });

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isOperador,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}