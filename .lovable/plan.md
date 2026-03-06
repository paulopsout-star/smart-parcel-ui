
Objetivo: corrigir o travamento real na criação de cobrança combinada (loading infinito + sem POST `/rest/v1/charges`) sem usar timeout/workaround.

1) Diagnóstico confirmado (com evidência)
- `src/pages/NewCharge.tsx`:
  - Log chega até `"[NewCharge] ⏳ Iniciando INSERT..."` (linhas ~391-393).
  - O travamento ocorre no `await supabase.from('charges').insert(...).select().single()` (linhas ~394-432).
- Console/Network:
  - Sintoma confirmado por você: **loading infinito**.
  - Confirmação crítica: **não aparece POST para `/rest/v1/charges`**.
- Conclusão técnica:
  - Se não há POST, o bloqueio ocorre **antes da requisição sair do browser**, dentro do client Supabase (obtenção de sessão/token/lock interno), não no banco/RLS.

2) Causa-raiz provável (e alvo do fix)
- `src/contexts/AuthContext.tsx` usa `supabase.auth.onAuthStateChange(async (...) => { ... await fetchProfile(...) ... })` (linhas ~89-114).
- Dentro do callback de auth há chamadas Supabase (`profiles`, `user_roles`) via `fetchProfile` (linhas ~35-49).
- Esse padrão é conhecido por gerar lock/reentrância no cliente auth em eventos de sessão (ex.: `SIGNED_IN`/`TOKEN_REFRESHED`), causando promises pendentes em outras queries.
- Isso casa exatamente com o seu sintoma: UI entra em loading e a chamada de insert não chega a virar request HTTP.

3) Plano de implementação (mudança direta na causa)
Arquivo: `src/contexts/AuthContext.tsx`
- Remover `async` do callback de `onAuthStateChange`.
- Não executar query Supabase diretamente dentro do callback.
- Extrair carregamento de perfil para função assíncrona externa e disparar fora do callback (microtask/`setTimeout(0)`/`void`), com controle de corrida:
  - Ignorar resposta antiga se chegar evento novo.
  - Aplicar estado apenas para a sessão vigente.
- Manter comportamento funcional atual (SIGNED_OUT limpa estado; SIGNED_IN/TOKEN_REFRESHED atualizam sessão).

Arquivo: `src/pages/NewCharge.tsx`
- Manter lógica de criação, mas adicionar logs diagnósticos curtos ao redor do insert para confirmar:
  - “antes de resolver sessão/token”
  - “insert request dispatchado”
  - “insert resolvido/erro”
- Não adicionar timeout novo; apenas observabilidade útil para futuras ocorrências.

4) Validação pós-fix (obrigatória)
- Reproduzir no mesmo fluxo `cartao_pix`:
  1. Preencher `amount`, `pix_amount`, `card_amount`, linha digitável (47).
  2. Clicar “Criar cobrança”.
- Critérios de aceite:
  - O loading não fica infinito.
  - Surge POST `/rest/v1/charges` na rede imediatamente após o clique.
  - A cobrança é criada e aparece no histórico.
  - Não há regressão de login/logout/profile.
- Checagens adicionais:
  - Garantir que não exista outro `onAuthStateChange` no projeto (já mapeado: apenas AuthContext).
  - Confirmar que não há outro ponto com chamada Supabase dentro de callback de auth.

5) Escopo e risco
- Escopo mínimo: somente fluxo de autenticação no `AuthContext` + instrumentação de logs no `NewCharge`.
- Sem alteração de contrato API, sem mudança de schema/RLS, sem workaround de timeout.
- Impacto esperado: eliminar travamento intermitente pré-request na criação de cobrança combinada.
