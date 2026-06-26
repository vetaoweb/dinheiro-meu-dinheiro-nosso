# Dinheiro Meu é Dinheiro Nosso!

Sistema autoral de organização financeira pessoal, compartilhada e profissional.

**Slogan:** Organize o seu. Construa o nosso.

## Fundação funcional v0.1.0

- identidade visual própria;
- landing page responsiva;
- cadastro, login e recuperação de acesso;
- painel autenticado;
- contas, lançamentos e recorrências;
- espaços pessoal, familiar e profissional;
- Termômetro Financeiro com horizonte móvel de 12 meses;
- banco relacional com isolamento por espaço;
- auditoria, exclusão lógica e páginas legais;
- configuração para Vercel e PWA.

## Conexão

O frontend está conectado ao projeto Supabase informado para este sistema. A configuração pública está em `js/env.js`.

## Instalação do banco

Execute primeiro `sql/000_auditoria.sql`, que faz somente consultas.

Depois execute no SQL Editor, um arquivo por vez:

1. `sql/001_base.sql`
2. `sql/002_auth_profiles.sql`
3. `sql/003_financial_core.sql`
4. `sql/003a_integrity.sql`
5. `sql/004_projection.sql`
6. `sql/005_rls.sql`
7. `sql/006_seed.sql`
8. `sql/006a_existing_users.sql`
9. `sql/007_verificacao.sql`

Interrompa a sequência no primeiro erro e preserve a mensagem completa antes de executar o arquivo seguinte.

## Execução local

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Publicação na Vercel

Importe o repositório como projeto estático:

- Framework Preset: `Other`;
- Build Command: vazio;
- Output Directory: `.`;
- Root Directory: `.`.

Depois cadastre a URL publicada no Supabase em **Authentication → URL Configuration**.

## Estrutura

```text
assets/      logotipo e ícone
app/         páginas autenticadas
css/         design system e estilos
js/          autenticação e módulos funcionais
sql/         auditoria, migrations e verificação
docs/        implantação
```
