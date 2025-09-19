import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Shield, Users, Zap, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-primary-foreground" />
              </div>
              <h1 className="text-xl font-bold">Sistema de Cobrança</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/register">Cadastrar</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold mb-6">
            Sistema de Cobrança Integrado ao Quita+
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Gerencie cobranças pontuais e recorrentes com total segurança e controle.
            Links de pagamento automáticos com integração completa ao Quita+.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/register">Começar Agora</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/login">Fazer Login</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold mb-4">Funcionalidades</h3>
          <p className="text-muted-foreground">
            Tudo que você precisa para gerenciar suas cobranças
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <Zap className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Cobranças Pontuais</CardTitle>
              <CardDescription>
                Crie links de pagamento instantâneos para cobranças únicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Links gerados automaticamente</li>
                <li>• Integração direta com Quita+</li>
                <li>• Compartilhamento via WhatsApp/Email</li>
                <li>• Controle de parcelas e taxas</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Cobranças Recorrentes</CardTitle>
              <CardDescription>
                Configure cobranças automáticas com diferentes períodos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Diária, semanal, quinzenal</li>
                <li>• Mensal, semestral, anual</li>
                <li>• Processamento automático via cron</li>
                <li>• Controle de timezone (América/São_Paulo)</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="w-12 h-12 text-primary mb-4" />
              <CardTitle>Segurança e Controle</CardTitle>
              <CardDescription>
                Sistema com autenticação segura e controle de acesso
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Autenticação com roles (Admin/Operador)</li>
                <li>• Logs completos de auditoria</li>
                <li>• Controle de idempotência</li>
                <li>• Rate limiting e CSRF protection</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Demo Section */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Veja como funciona</h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Experimente nossa demonstração de pagamento para clientes.
          </p>
          <div className="flex justify-center gap-4">
            <Button size="lg" variant="outline" asChild>
              <Link to="/payment">
                Demo de Pagamento
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-bold mb-4">Pronto para começar?</h3>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            Cadastre-se agora e comece a gerenciar suas cobranças de forma profissional.
            O sistema é seguro, rápido e totalmente integrado ao Quita+.
          </p>
          <Button size="lg" asChild>
            <Link to="/register">Criar Conta Gratuita</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Sistema de Cobrança. Integrado ao Quita+.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
