import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
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
      // Buscar profile e role em paralelo (Promise.all reduz latência de ~800ms para ~400ms)
      const [profileResult, roleResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, is_active, company_id, created_at, updated_at')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      if (profileResult.error) {
        console.error('❌ [AuthContext] Erro ao buscar profile:', profileResult.error);
        return null;
      }

      if (!profileResult.data) {
        console.error('❌ [AuthContext] Profile data está vazio/null');
        return null;
      }

      if (roleResult.error) {
        console.warn('⚠️ [AuthContext] Erro ao buscar role (usando default):', roleResult.error);
      }

      const role = roleResult.data?.role || 'operador';

      const profile: Profile = {
        ...profileResult.data,
        role,
      };

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