import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CreditCard, ArrowRight, Shield, Clock, Users } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full mb-6">
              <CreditCard className="w-4 h-4" />
              <span className="text-sm font-medium">Sistema de Pagamentos</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Página de Pagamentos
              <span className="block text-primary">Inteligente</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Uma experiência completa de checkout com múltiplas opções de parcelamento, 
              designed para maximizar conversões e satisfação do cliente.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/payment">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all duration-300 shadow-lg hover:shadow-xl">
                  Ver Demonstração
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/admin/checkout/new">
                <Button size="lg" variant="outline" className="gap-2">
                  Admin QuitaMais
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Parcelamento Flexível</h3>
              <p className="text-muted-foreground text-sm">
                Múltiplas opções de parcelamento para atender diferentes perfis de cliente
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Shield className="w-6 h-6 text-success" />
              </div>
              <h3 className="font-semibold text-lg mb-2">100% Seguro</h3>
              <p className="text-muted-foreground text-sm">
                Pagamentos protegidos com criptografia SSL e validação em tempo real
              </p>
            </div>

            <div className="p-6 bg-card rounded-xl border shadow-sm hover:shadow-md transition-all duration-300">
              <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Users className="w-6 h-6 text-warning" />
              </div>
              <h3 className="font-semibold text-lg mb-2">UX Otimizada</h3>
              <p className="text-muted-foreground text-sm">
                Interface intuitiva baseada em data-driven decisions e testes A/B
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <div className="p-8 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl border">
            <h2 className="text-2xl font-bold mb-4">Pronto para testar?</h2>
            <p className="text-muted-foreground mb-6">
              Experimente nosso sistema de pagamentos e veja como pode melhorar sua conversão
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/payment">
                <Button variant="outline" size="lg" className="gap-2">
                  Acessar Página de Pagamento
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/admin/checkout/history">
                <Button variant="outline" size="lg" className="gap-2">
                  Histórico de Links
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
