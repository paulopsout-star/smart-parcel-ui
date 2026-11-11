import { useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { useLoginForm } from '@/hooks/useLoginForm';

/**
 * Nova página de login (rota temporária /entrar, sem links no app, não indexada).
 * Mesmo comportamento de /login via useLoginForm; só a apresentação é diferente.
 * A identidade visual definitiva será aplicada aqui; na troca, /login passa a renderizar este componente.
 */
export default function LoginV2() {
  const { email, setEmail, password, setPassword, isLoading, error, handleSubmit, authLoading, isAuthenticated } = useLoginForm();

  // Rota de transição: não deixar buscadores indexarem
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ds-bg-body">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-ds-bg-body">
      {/* Painel lateral: espaço para a identidade visual (imagem, cor, mensagem) */}
      <aside className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-12">
        <div className="text-lg font-semibold tracking-tight">Autonegocie</div>
        <div className="space-y-3 max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Cobranças, PIX e cartão em um só lugar.</h2>
          <p className="text-primary-foreground/80">Acesse sua conta para gerenciar cobranças e acompanhar pagamentos.</p>
        </div>
        <p className="text-xs text-primary-foreground/60">© {new Date().getFullYear()} Autonegocie</p>
      </aside>

      {/* Formulário */}
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Entrar</h1>
            <p className="text-sm text-ds-text-muted">Use o e-mail e a senha da sua conta.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="v2-email">E-mail</Label>
              <Input
                id="v2-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                disabled={isLoading}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="v2-password">Senha</Label>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                  Esqueci minha senha
                </Link>
              </div>
              <Input
                id="v2-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                disabled={isLoading}
                required
                className="h-11"
              />
            </div>

            <Button type="submit" className="w-full h-11" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-ds-text-muted">
            Não tem uma conta?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Cadastre-se aqui
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
