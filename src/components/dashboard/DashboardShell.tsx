import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { toast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  useSessionTimeout();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: 'Erro ao sair',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      navigate('/');
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-ds-bg-body">
        {/* Sidebar */}
        <DashboardSidebar onSignOut={handleSignOut} />

        {/* Main Content */}
        <main className="pl-28 pr-6 py-6">
          <div className="max-w-[1440px] mx-auto">
            <DashboardHeader onSignOut={handleSignOut} />
            {children}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
