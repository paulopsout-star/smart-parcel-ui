import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutos
const WARNING_BEFORE = 1 * 60 * 1000; // Aviso 1 minuto antes
const THROTTLE_MS = 30_000; // Só resetar timer a cada 30s

export function useSessionTimeout() {
  const { signOut, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningRef = useRef<NodeJS.Timeout>();
  const lastResetRef = useRef<number>(0);

  const forceLocalLogout = useCallback(async () => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));

    try {
      await signOut();
    } catch (e) {
      console.warn('[SessionTimeout] signOut falhou:', e);
    }

    toast({
      title: "Sessão expirada",
      description: "Você foi desconectado por inatividade.",
    });

    window.location.href = '/login';
  }, [signOut]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!user) return;

    warningRef.current = setTimeout(() => {
      toast({
        title: "⚠️ Sessão expirando",
        description: "Sua sessão expirará em 1 minuto por inatividade.",
        variant: "destructive",
      });
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    timeoutRef.current = setTimeout(() => {
      forceLocalLogout();
    }, INACTIVITY_TIMEOUT);
  }, [user, forceLocalLogout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;
      resetTimer();
    };

    events.forEach(event => document.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetTimer]);
}
