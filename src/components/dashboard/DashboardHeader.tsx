import { Bell, HelpCircle, Search } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, User } from 'lucide-react';

interface DashboardHeaderProps {
  onSignOut: () => void;
}

export function DashboardHeader({ onSignOut }: DashboardHeaderProps) {
  const { user, profile } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date());
  };

  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-semibold text-ds-text-strong tracking-tight">
          {getGreeting()}, {profile?.full_name?.split(' ')[0] || 'Usuário'}!
        </h1>
        <p className="text-sm text-ds-text-muted capitalize">{formatDate()}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ds-text-muted" />
          <Input
            placeholder="Buscar..."
            className="w-64 pl-10 h-10 rounded-full bg-ds-bg-surface border-ds-border-subtle focus:border-brand focus:ring-1 focus:ring-brand/20"
          />
        </div>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative w-10 h-10 rounded-full bg-ds-bg-surface shadow-card-flat hover:shadow-card-soft transition-shadow"
        >
          <Bell className="w-4 h-4 text-ds-text-default" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand rounded-full" />
        </Button>

        {/* Help */}
        <Button
          variant="ghost"
          size="icon"
          className="w-10 h-10 rounded-full bg-ds-bg-surface shadow-card-flat hover:shadow-card-soft transition-shadow"
        >
          <HelpCircle className="w-4 h-4 text-ds-text-default" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-10 w-10 rounded-full p-0 ring-2 ring-ds-border-subtle hover:ring-brand/50 transition-all"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-brand text-white font-medium">
                  {profile ? getInitials(profile.full_name) : <User className="w-4 h-4" />}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-ds-bg-surface border-ds-border-subtle shadow-floating rounded-card"
            align="end"
          >
            <div className="flex flex-col space-y-1 p-3">
              <p className="text-sm font-medium text-ds-text-strong">{profile?.full_name}</p>
              <p className="text-xs text-ds-text-muted">{user?.email}</p>
              <p className="text-xs text-brand capitalize font-medium">
                {profile?.role === 'admin' ? 'Administrador' : 'Operador'}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-ds-border-subtle" />
            <DropdownMenuItem
              onClick={onSignOut}
              className="text-ds-text-default hover:bg-ds-bg-surface-alt cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
