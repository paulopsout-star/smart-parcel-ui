import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

/**
 * Comportamento do login, compartilhado pela página atual (/login) e pela nova (/entrar).
 * As páginas só trocam a apresentação: validação, tratamento de erro, toast e estados vivem aqui,
 * para as duas versões nunca divergirem.
 */
export function useLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, user, loading } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error } = await signIn(email, password);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu email antes de fazer login.');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } else {
      toast({
        title: 'Login realizado com sucesso!',
        description: 'Bem-vindo ao sistema.',
      });
    }

    setIsLoading(false);
  };

  return {
    email, setEmail,
    password, setPassword,
    isLoading,
    error,
    handleSubmit,
    /** Sessão ainda carregando: mostrar spinner. */
    authLoading: loading,
    /** Já logado: redirecionar para o painel. */
    isAuthenticated: !!user,
  };
}
