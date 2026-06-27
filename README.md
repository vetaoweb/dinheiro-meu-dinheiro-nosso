# Dinheiro Meu é Dinheiro Nosso!

Sistema autoral de organização financeira pessoal, compartilhada e profissional.

**Slogan:** Organize o seu. Construa o nosso.

## Fundação funcional v0.3.0

- identidade visual própria;
- landing page responsiva;
- cadastro com página de confirmação de e-mail;
- login, recuperação e redefinição de acesso;
- painel autenticado;
- contas, lançamentos e recorrências;
- metas financeiras com progresso e prazo;
- espaços pessoal, familiar e profissional;
- convites por link para espaços compartilhados;
- integrantes com papéis de administrador, editor ou visualizador;
- Termômetro Financeiro com horizonte móvel de 12 meses;
- banco relacional com isolamento por espaço;
- auditoria, exclusão lógica e páginas legais;
- publicação automática no GitHub Pages;
- PWA com manifesto e service worker;
- estratégia documentada para futura cobrança pelo PagBank.

## Conexão

O frontend está conectado ao projeto Supabase informado para este sistema. A configuração pública está em `js/env.js`.

## Instalação inicial do banco

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
10. `sql/008_collaboration.sql`
11. `sql/009_verificacao_colaboracao.sql`
12. `sql/010_auth_onboarding_repair.sql`
13. `sql/011_verificacao_auth.sql`
14. `sql/012_fix_auth_function_permissions.sql`
15. `sql/013_restore_seed_space_defaults.sql`

Para o banco que já foi instalado até o arquivo `012`, execute agora somente:

```text
sql/013_restore_seed_space_defaults.sql
```

Interrompa a sequência no primeiro erro e preserve a mensagem completa antes de executar o arquivo seguinte.

## Cadastro e preparação da conta

O cadastro cria o usuário no Supabase Auth e envia a confirmação por e-mail. Depois da autenticação, a função `ensure_user_workspace()` garante, sem duplicar:

- perfil;
- espaço pessoal “Meu dinheiro”;
- papel de proprietário;
- conta principal;
- categorias financeiras iniciais.

## Colaboração

Em um espaço familiar ou profissional, proprietários e administradores podem:

- informar o e-mail da pessoa;
- escolher a permissão;
- gerar um link com validade de sete dias;
- copiar e enviar o link manualmente;
- acompanhar e cancelar convites pendentes.

O convite só pode ser aceito por uma conta cadastrada com o mesmo e-mail. O espaço pessoal continua privado e não aceita outros integrantes.

## Acesso gratuito e pagamentos

O sistema permanece gratuito durante a fase beta, sem cartão e sem cobrança automática. A estratégia para futura monetização com PagBank está em:

```text
docs/PAGAMENTOS_PAGBANK.md
```

Tokens privados de pagamento nunca devem ser colocados no frontend ou no GitHub Pages.

## Execução local

```bash
python -m http.server 8080
```

Acesse `http://localhost:8080`.

## Publicação no GitHub Pages

O workflow `.github/workflows/pages.yml` prepara automaticamente a versão compatível com o endereço de projeto do GitHub Pages e publica a cada alteração na branch `main`.

No GitHub, abra:

```text
Settings → Pages → Build and deployment → Source: GitHub Actions
```

A URL prevista é:

```text
https://vetaoweb.github.io/dinheiro-meu-dinheiro-nosso/
```

No Supabase, cadastre essa URL em **Authentication → URL Configuration** como `Site URL` e adicione também:

```text
https://vetaoweb.github.io/dinheiro-meu-dinheiro-nosso/**
```

em `Redirect URLs`.

## Estrutura

```text
assets/      logotipo e ícone
app/         páginas autenticadas
css/         design system e estilos
js/          autenticação e módulos funcionais
scripts/     preparação da versão GitHub Pages
sql/         auditoria, migrations e verificação
docs/        documentação
```
