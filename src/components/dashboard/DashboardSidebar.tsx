import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Home,
  Plus,
  History,
  Users,
  Building2,
  RefreshCw,
  Repeat,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const mainNavItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Nova Cobrança', href: '/new-charge', icon: Plus },
  { name: 'Histórico', href: '/charges', icon: History },
];

const adminNavItems = [
  { name: 'Usuários', href: '/admin/users', icon: Users },
  { name: 'Empresas', href: '/admin/companies', icon: Building2 },
  { name: 'Estornos', href: '/admin/refunds', icon: RefreshCw },
  { name: 'Recorrentes', href: '/admin/recurrences', icon: Repeat },
  { name: 'Relatórios', href: '/admin/reports', icon: BarChart3 },
  { name: 'Configurações', href: '/admin/settings', icon: Settings },
];

interface DashboardSidebarProps {
  onSignOut: () => void;
}

export function DashboardSidebar({ onSignOut }: DashboardSidebarProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const isActive = (href: string) => location.pathname === href;

  const NavItem = ({ item }: { item: typeof mainNavItems[0] }) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={item.href}
            className={cn(
              'relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-200',
              active
                ? 'bg-ds-bg-surface shadow-card-soft text-brand'
                : 'text-white/80 hover:bg-white/10 hover:text-white'
            )}
          >
            {active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand rounded-r-full" />
            )}
            <Icon className="w-5 h-5" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-ds-bg-surface text-ds-text-default border-ds-border-subtle">
          {item.name}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="fixed left-4 top-4 bottom-4 w-20 bg-gradient-sidebar rounded-sidebar flex flex-col items-center py-6 z-50">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
          <span className="text-white font-bold text-lg">A</span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center space-y-2">
        {mainNavItems.map((item) => (
          <NavItem key={item.href} item={item} />
        ))}

        {/* Separator */}
        {isAdmin && (
          <>
            <div className="w-8 h-px bg-white/20 my-4" />
            {adminNavItems.map((item) => (
              <NavItem key={item.href} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center space-y-2 mt-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-12 h-12 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-ds-bg-surface text-ds-text-default border-ds-border-subtle">
            Ajuda
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="w-12 h-12 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-ds-bg-surface text-ds-text-default border-ds-border-subtle">
            Sair
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}
