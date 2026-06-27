# Testes do fluxo integral do painel

Use duas contas de e-mail confirmadas para validar colaboração e permissões.

## 1. Autenticação

1. Criar uma conta.
2. Confirmar o e-mail.
3. Entrar.
4. Confirmar que o painel abre com o espaço `Meu dinheiro`.
5. Sair e entrar novamente.
6. Testar recuperação e redefinição de senha.

## 2. Espaço pessoal

1. Confirmar que existe a `Conta principal`.
2. Confirmar que existem 12 categorias iniciais.
3. Criar uma segunda conta.
4. Verificar que o espaço pessoal não oferece convite de integrantes.

## 3. Lançamentos

1. Criar uma entrada prevista.
2. Criar uma despesa prevista.
3. Criar uma economia prevista.
4. Criar uma transferência entre contas diferentes.
5. Confirmar que uma transferência não entra como despesa.
6. Marcar um lançamento como pago e conferir a alteração do saldo.
7. Excluir logicamente um lançamento e confirmar que ele deixa a lista.

## 4. Recorrências

1. Criar uma receita mensal.
2. Criar uma despesa semanal.
3. Criar uma economia anual.
4. Conferir as ocorrências na projeção.
5. Excluir uma recorrência.

## 5. Termômetro Financeiro

1. Confirmar 12 meses de projeção.
2. Conferir entradas, saídas, economias e fluxo líquido.
3. Confirmar meses em risco quando o saldo fica negativo.
4. Alterar o mês inicial e atualizar.

## 6. Metas

1. Criar uma meta com valor e prazo.
2. Adicionar progresso.
3. Pausar e retomar.
4. Concluir.
5. Arquivar.
6. Conferir o resumo no painel principal.

## 7. Espaços compartilhados

1. Criar um espaço familiar.
2. Confirmar conta e categorias iniciais.
3. Criar convite para a segunda conta.
4. Abrir o link em janela anônima.
5. Entrar com o e-mail convidado e aceitar.
6. Confirmar que o espaço aparece para as duas contas.

## 8. Papéis

- `owner`: administra o espaço, convites e dados financeiros.
- `admin`: administra convites e dados financeiros.
- `editor`: cria e altera contas, lançamentos, recorrências e metas.
- `viewer`: consulta os dados sem botões de alteração.

## 9. Auditoria técnica

Executar:

```text
sql/015_verificacao_fluxos_painel.sql
```

O resumo final deve mostrar todas as funções esperadas encontradas e todas as 11 tabelas protegidas por RLS.
