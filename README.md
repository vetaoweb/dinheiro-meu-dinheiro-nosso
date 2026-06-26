# Dinheiro Meu é Dinheiro Nosso!

Sistema autoral de organização financeira pessoal, compartilhada e profissional.

**Slogan:** Organize o seu. Construa o nosso.

## Estado desta entrega

Esta é a fundação funcional **v0.1.0**:

- marca e identidade visual próprias;
- landing page responsiva;
- cadastro, login, recuperação e redefinição de senha;
- painel autenticado;
- cadastro e listagem de lançamentos;
- Termômetro Financeiro com projeção móvel dos próximos 12 meses;
- seleção de espaço financeiro pessoal, familiar ou profissional;
- migrations PostgreSQL/Supabase;
- RLS e isolamento por espaço financeiro;
- documentação de implantação.

## Configuração obrigatória

Edite `js/env.js` e substitua:

```js
SUPABASE_ANON_KEY: '__INFORME_A_CHAVE_ANON_PUBLICA__'
```

A URL pública já está configurada:

```text
https://bcsctqfelxlzwcskgmmp.supabase.co
```

A chave `anon`/`publishable` é pública e pode ficar no frontend. **Nunca coloque a `service_role` no repositório ou no navegador.**

## Banco de dados

Execute no SQL Editor do Supabase, nesta ordem:

1. `sql/000_auditoria.sql` — somente leitura, para verificar o estado atual;
2. `sql/001_base.sql`;
3. `sql/002_auth_profiles.sql`;
4. `sql/003_financial_core.sql`;
5. `sql/004_projection.sql`;
6. `sql/005_rls.sql`;
7. `sql/006_seed.sql`.

## Execução local

Não abra os arquivos diretamente com `file://`. Use um servidor HTTP local:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Deploy na Vercel

O projeto é estático. Importe o repositório na Vercel e mantenha:

- Framework Preset: `Other`;
- Build Command: vazio;
- Output Directory: `.`;
- Root Directory: `.`.

## Estrutura

```text
assets/      identidade visual em SVG
app/         páginas autenticadas
css/         design system e estilos
js/          autenticação, Supabase e módulos funcionais
sql/         auditoria, migrations, RLS e seeds
docs/        arquitetura e implantação
```

## Segurança

- RLS habilitada nas tabelas operacionais;
- dados isolados por `financial_space_id`;
- `auth.uid()` como identidade real;
- nenhum segredo administrativo no frontend;
- validação de participação e papel no banco;
- exclusão lógica para registros financeiros;
- funções auxiliares com `search_path` fixado.
