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
      console.log('🔍 [1/3] Fetching profile for user ID:', userId);
      
      // 1. Buscar profile (SEM role - vem de user_roles)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, is_active, company_id, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ [1/3] Error fetching profile:', profileError);
        return null;
      }
      
      console.log('✅ [2/3] Profile loaded:', profileData.full_name);

      // 2. Buscar role da tabela user_roles (fonte única de verdade)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(); // Não falha se não existir

      if (roleError) {
        console.error('⚠️ [2/3] Role query error (using default):', roleError);
      }

      const role = roleData?.role || 'operador';
      
      console.log('✅ [3/3] Role determined:', role, {
        from_user_roles: !!roleData,
        is_admin: role === 'admin',
        is_active: profileData.is_active
      });

      const profile: Profile = {
        ...profileData,
        role,
      };

      return profile;
    } catch (error) {
      console.error('❌ Unexpected error in fetchProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch profile after auth state change
          setTimeout(async () => {
            const userProfile = await fetchProfile(session.user.id);
            setProfile(userProfile);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          const userProfile = await fetchProfile(session.user.id);
          setProfile(userProfile);
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

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
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const isAdmin = profile?.role === 'admin' && profile?.is_active;
  const isOperador = (profile?.role === 'operador' || profile?.role === 'admin') && profile?.is_active;

  // Debug logging
  console.log('Auth Debug - Profile:', profile);
  console.log('Auth Debug - isAdmin:', isAdmin);
  console.log('Auth Debug - isOperador:', isOperador);
  console.log('Auth Debug - loading:', loading);

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