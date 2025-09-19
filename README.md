# Sistema de Pagamentos QuitaMais

## Project info

**URL**: https://lovable.dev/projects/eaddac47-07ed-4011-8ff8-fc1b25fafe6b

## Sobre o Projeto

Sistema de pagamentos integrado com a API QuitaMais para processamento de transações via cartão de crédito. O projeto inclui:

- Interface moderna para seleção de opções de pagamento
- Formulário completo para dados do pagador e cartão
- Integração segura com API QuitaMais via Supabase Edge Functions
- Armazenamento de transações no banco Supabase
- Estados de loading, sucesso e erro otimizados

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/eaddac47-07ed-4011-8ff8-fc1b25fafe6b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Backend/Database)
- QuitaMais API (Payment Processing)

## ⚠️ Configuração Necessária

### 1. Secrets do Supabase
Configure os seguintes secrets no Supabase (já adicionados):
- `QUITA_MAIS_MERCHANT_ID` - ID do comerciante QuitaMais
- `QUITA_MAIS_CREDITOR_NAME` - Nome do credor
- `QUITA_MAIS_CREDITOR_DOCUMENT` - Documento do credor

### 2. Tabela de Transações
Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Criar tabela de transações
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id TEXT UNIQUE NOT NULL,
  payer_name TEXT NOT NULL,
  payer_email TEXT NOT NULL,
  payer_document TEXT NOT NULL,
  amount_in_cents INTEGER NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PENDING',
  quita_mais_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id ON public.transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payer_email ON public.transactions(payer_email);

-- Habilitar RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir operações" ON public.transactions FOR ALL USING (true);
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/eaddac47-07ed-4011-8ff8-fc1b25fafe6b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
