import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const WARNING_BEFORE = 1 * 60 * 1000; // Aviso 1 minuto antes

export function useSessionTimeout() {
  const { signOut, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();

  const forceLocalLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (e) {
      console.warn('[SessionTimeout] signOut falhou, limpando local:', e);
    }

    // SEMPRE limpar localStorage do Supabase, independente do resultado
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });

    toast({
      title: "Sessão expirada",
      description: "Você foi desconectado por inatividade.",
    });

    // Forçar navegação para login (hard redirect para evitar estado stale)
    window.location.href = '/login';
  }, [signOut]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!user) return;

    // Timer de aviso (4 minutos)
    warningRef.current = setTimeout(() => {
      toast({
        title: "⚠️ Sessão expirando",
        description: "Sua sessão expirará em 1 minuto por inatividade.",
        variant: "destructive",
      });
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    // Timer de logout (5 minutos)
    timeoutRef.current = setTimeout(() => {
      forceLocalLogout();
    }, INACTIVITY_TIMEOUT);
  }, [user, forceLocalLogout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetTimer]);
}
