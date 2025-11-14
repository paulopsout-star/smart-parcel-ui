import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, UserPlus, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'operador';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  company_id: string;
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    try {
      // Buscar profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, is_active, created_at, updated_at, company_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Buscar roles de user_roles para cada profile
      const profilesWithRoles = await Promise.all(
        (profilesData || []).map(async (profile) => {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .maybeSingle();

          return {
            ...profile,
            role: (roleData?.role || 'operador') as 'admin' | 'operador',
          };
        })
      );

      setProfiles(profilesWithRoles);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (id: string, updates: Partial<Profile>) => {
    try {
      // Se está atualizando role, atualizar em user_roles
      if (updates.role) {
        // Verificar se já existe um registro em user_roles
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', id)
          .maybeSingle();

        if (existingRole) {
          // Atualizar role existente
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: updates.role })
            .eq('user_id', id);

          if (roleError) throw roleError;
        } else {
          // Criar novo registro de role
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: id, role: updates.role });

          if (roleError) throw roleError;
        }
        
        // Remover role do updates para não tentar atualizar em profiles
        const { role, ...profileUpdates } = updates;
        updates = profileUpdates;
      }

      // Atualizar apenas campos de profiles (sem role)
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', id);

        if (error) throw error;
      }

      toast({
        title: "Usuário atualizado",
        description: "As alterações foram salvas com sucesso",
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta área.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    return role === 'admin' ? (
      <Badge>Administrador</Badge>
    ) : (
      <Badge variant="secondary">Operador</Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
        <Button onClick={fetchProfiles} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-6">
        {profiles.map((profile) => (
          <Card key={profile.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{profile.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">ID: {profile.id}</p>
                </div>
                <div className="flex gap-2">
                  {getRoleBadge(profile.role)}
                  {profile.is_active ? (
                    <Badge variant="default">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Inativo</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">Criado em</p>
                  <p>{format(new Date(profile.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Atualizado em</p>
                  <p>{format(new Date(profile.updated_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={profile.is_active}
                    onCheckedChange={(checked) => 
                      updateProfile(profile.id, { is_active: checked })
                    }
                  />
                  <label className="text-sm font-medium">Usuário ativo</label>
                </div>

                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Função:</label>
                  <Select
                    value={profile.role}
                    onValueChange={(value) => 
                      updateProfile(profile.id, { role: value as 'admin' | 'operador' })
                    }
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {profiles.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}