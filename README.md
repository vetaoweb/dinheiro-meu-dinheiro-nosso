# Dinheiro Meu é Dinheiro Nosso!

Sistema autoral de organização financeira pessoal, compartilhada e profissional.

**Slogan:** Organize o seu. Construa o nosso.

## Fundação funcional v0.2.0

- identidade visual própria;
- landing page responsiva;
- cadastro, login e recuperação de acesso;
- painel autenticado;
- contas, lançamentos e recorrências;
- espaços pessoal, familiar e profissional;
- convites por link para espaços compartilhados;
- integrantes com papéis de administrador, editor ou visualizador;
- Termômetro Financeiro com horizonte móvel de 12 meses;
- banco relacional com isolamento por espaço;
- auditoria, exclusão lógica e páginas legais;
- publicação automática no GitHub Pages;
- PWA com manifesto e service worker.

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

Quem já concluiu a instalação até o arquivo `007_verificacao.sql` precisa executar somente:

```text
sql/008_collaboration.sql
sql/009_verificacao_colaboracao.sql
```

Interrompa a sequência no primeiro erro e preserve a mensagem completa antes de executar o arquivo seguinte.

## Colaboração

Em um espaço familiar ou profissional, proprietários e administradores podem:

- informar o e-mail da pessoa;
- escolher a permissão;
- gerar um link com validade de sete dias;
- copiar e enviar o link manualmente;
- acompanhar e cancelar convites pendentes.

O convite só pode ser aceito por uma conta cadastrada com o mesmo e-mail. O espaço pessoal continua privado e não aceita outros integrantes.

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
