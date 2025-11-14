import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, RefreshCw, UserPlus, Building2, Trash2, KeyRound } from 'lucide-react';
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
  company_name?: string;
}

interface Company {
  id: string;
  name: string;
}

interface NewUserData {
  email: string;
  password: string;
  full_name: string;
  company_id: string;
  role: 'admin' | 'operador';
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  
  // Filtros
  const [searchName, setSearchName] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [newUserData, setNewUserData] = useState<NewUserData>({
    email: '',
    password: '',
    full_name: '',
    company_id: '',
    role: 'operador'
  });

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar empresas:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, is_active, created_at, updated_at, company_id')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name');

      const companyMap = new Map(companiesData?.map(c => [c.id, c.name]) || []);

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
            company_name: companyMap.get(profile.company_id) || 'Empresa não encontrada'
          };
        })
      );

      setProfiles(profilesWithRoles);
      setFilteredProfiles(profilesWithRoles);
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

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
      fetchCompanies();
    }
  }, [isAdmin]);

  useEffect(() => {
    let filtered = profiles;

    if (searchName.trim()) {
      filtered = filtered.filter(p => 
        p.full_name.toLowerCase().includes(searchName.toLowerCase())
      );
    }

    if (filterCompany !== 'all') {
      filtered = filtered.filter(p => p.company_id === filterCompany);
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(p => p.role === filterRole);
    }

    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active';
      filtered = filtered.filter(p => p.is_active === isActive);
    }

    setFilteredProfiles(filtered);
  }, [searchName, filterCompany, filterRole, filterStatus, profiles]);

  const createUser = async () => {
    try {
      setIsCreating(true);

      if (!newUserData.email || !newUserData.password || !newUserData.full_name || !newUserData.company_id) {
        throw new Error('Todos os campos são obrigatórios');
      }

      if (newUserData.password.length < 6) {
        throw new Error('A senha deve ter no mínimo 6 caracteres');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newUserData.email)) {
        throw new Error('Email inválido');
      }

      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: newUserData
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      toast({
        title: "Usuário criado",
        description: "Novo usuário cadastrado com sucesso",
      });

      setIsCreateDialogOpen(false);
      setNewUserData({
        email: '',
        password: '',
        full_name: '',
        company_id: '',
        role: 'operador'
      });
      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const updateProfile = async (id: string, updates: Partial<Profile>) => {
    try {
      if (updates.role) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', id)
          .maybeSingle();

        if (existingRole) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role: updates.role })
            .eq('user_id', id);

          if (roleError) throw roleError;
        } else {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({ user_id: id, role: updates.role });

          if (roleError) throw roleError;
        }
        
        const { role, ...profileUpdates } = updates;
        updates = profileUpdates;
      }

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

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Email enviado",
        description: "Um link para redefinir a senha foi enviado para o email do usuário",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao resetar senha",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    try {
      await supabase.from('user_roles').delete().eq('user_id', userId);
      const { error } = await supabase.from('profiles').delete().eq('id', userId);

      if (error) throw error;

      toast({
        title: "Usuário removido",
        description: `${userName} foi removido do sistema`,
      });

      fetchProfiles();
    } catch (error: any) {
      toast({
        title: "Erro ao deletar usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          <p className="text-muted-foreground">Gerencie os usuários do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/admin/companies">
              <Building2 className="w-4 h-4 mr-2" />
              Gerenciar Empresas
            </Link>
          </Button>
          <Button onClick={fetchProfiles} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Criar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Preencha os dados para criar um novo usuário no sistema
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    placeholder="Nome do usuário"
                    value={newUserData.full_name}
                    onChange={(e) => setNewUserData({ ...newUserData, full_name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="company">Empresa *</Label>
                  <Select value={newUserData.company_id} onValueChange={(value) => setNewUserData({ ...newUserData, company_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Função *</Label>
                  <Select value={newUserData.role} onValueChange={(value: 'admin' | 'operador') => setNewUserData({ ...newUserData, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                  Cancelar
                </Button>
                <Button onClick={createUser} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Usuário'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar por nome</Label>
              <Input
                id="search"
                placeholder="Digite o nome..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-company">Empresa</Label>
              <Select value={filterCompany} onValueChange={setFilterCompany}>
                <SelectTrigger id="filter-company">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-role">Função</Label>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger id="filter-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="operador">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : filteredProfiles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum usuário encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredProfiles.map((profile) => (
            <Card key={profile.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{profile.full_name}</h3>
                      <Badge variant={profile.is_active ? "default" : "secondary"}>
                        {profile.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant={profile.role === 'admin' ? "destructive" : "outline"}>
                        {profile.role === 'admin' ? 'Administrador' : 'Operador'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <strong>Empresa:</strong> {profile.company_name}
                    </p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>Criado: {format(new Date(profile.created_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                      <span>Atualizado: {format(new Date(profile.updated_at), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${profile.id}`} className="text-sm">Ativo</Label>
                      <Switch
                        id={`active-${profile.id}`}
                        checked={profile.is_active}
                        onCheckedChange={(checked) => updateProfile(profile.id, { is_active: checked })}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Label htmlFor={`role-${profile.id}`} className="text-sm">Função</Label>
                      <Select
                        value={profile.role}
                        onValueChange={(value: 'admin' | 'operador') => updateProfile(profile.id, { role: value })}
                      >
                        <SelectTrigger id={`role-${profile.id}`} className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operador">Operador</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetPassword(profile.id)}
                    >
                      <KeyRound className="w-4 h-4 mr-2" />
                      Resetar Senha
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Deletar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja deletar o usuário <strong>{profile.full_name}</strong>?
                            Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteUser(profile.id, profile.full_name)}>
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
