

# Otimização RLS — Reduzir Function Calls por Row

## Problema Atual

Cada policy na tabela `charges` avalia esta expressão **por row**:

```text
has_role(auth.uid(), 'admin')
  OR (is_admin_or_operador(auth.uid()) AND company_id = get_user_company_id(auth.uid()))
```

Isso executa **3 sub-queries separadas** em `user_roles` e `profiles` para cada row retornada. Com 200 charges, são ~600 sub-queries por request. O mesmo padrão se repete em `charge_executions`, `companies` e `payment_links`.

## Solução: Função única `can_access_company`

Criar **uma única** função `SECURITY DEFINER` que resolve tudo em **1 query** com JOIN, retornando se o usuário é admin (acesso total) ou se pertence àquela company_id:

```sql
CREATE OR REPLACE FUNCTION public.can_access_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND (
        ur.role = 'admin'
        OR (
          ur.role IN ('admin', 'operador')
          AND _company_id = (SELECT company_id FROM public.profiles WHERE id = _user_id)
        )
      )
  )
$$;
```

**De 3 function calls por row → 1 function call por row.** E internamente, a query usa os índices existentes (`idx_user_roles_user_id`, `profiles_pkey`).

## Migração das Policies

Substituir as policies das 4 tabelas afetadas:

### charges (SELECT, INSERT, UPDATE)
```sql
-- DROP + CREATE para cada command
-- Antes: has_role(...) OR (is_admin_or_operador(...) AND company_id = get_user_company_id(...))
-- Depois: can_access_company(auth.uid(), company_id)
```

### charge_executions (SELECT)
Mesma substituição.

### companies (SELECT para non-admin)
A policy "Users can view their own company" usa `get_user_company_id` — substituir por:
```sql
id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
```
Ou manter `get_user_company_id` aqui (é 1 call por row, aceitável para a tabela `companies` que tem poucos registros).

### payment_links (SELECT, INSERT)
Mesma substituição `can_access_company(auth.uid(), company_id)`.

## Tabelas e policies afetadas

| Tabela | Policies | Calls antes | Calls depois |
|--------|----------|-------------|--------------|
| charges | SELECT, INSERT, UPDATE | 3/row | 1/row |
| charge_executions | SELECT | 3/row | 1/row |
| payment_links | SELECT, INSERT | 2-3/row | 1/row |
| companies | ALL (admin), SELECT | 1-2/row | sem mudança |

## Impacto esperado

- **Dashboard**: query de charges com 200 rows passa de ~600 sub-queries para ~200
- **ChargeHistory**: mesma redução proporcional
- **Sem mudança de comportamento**: a lógica de acesso permanece idêntica (admin vê tudo, operador vê só sua empresa)

## Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| Nova migração SQL | Criar `can_access_company()` + DROP/CREATE policies |

Nenhum arquivo frontend é alterado — as queries Supabase continuam iguais.

