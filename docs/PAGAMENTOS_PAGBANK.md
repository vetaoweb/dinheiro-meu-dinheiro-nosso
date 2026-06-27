# Estratégia de pagamentos com PagBank

## Decisão para a fase atual

O sistema permanece gratuito durante a fase beta. Nenhum usuário será cobrado automaticamente e nenhum cartão será solicitado para criar a conta.

## Caminho recomendado

### Etapa 1 — Beta gratuita

- validar cadastro, painel, lançamentos, metas e espaços compartilhados;
- medir uso real;
- definir limites e preços antes de ativar cobrança;
- não criar assinaturas enquanto o produto ainda está em validação.

### Etapa 2 — Primeiros clientes pagos

Usar Link de Pagamento Recorrente do PagBank e ativação administrativa após confirmação do pagamento. O cliente paga dentro do ambiente do PagBank e o sistema não recebe dados do cartão.

Essa etapa é adequada para um volume pequeno, mas exige conferência e ativação manual da assinatura.

### Etapa 3 — Automação

Implementar a integração no backend por Supabase Edge Functions:

1. criar checkout ou assinatura no PagBank;
2. redirecionar o cliente ao ambiente seguro de pagamento;
3. receber notificações por webhook;
4. validar a notificação no servidor;
5. atualizar a assinatura no banco;
6. liberar ou restringir recursos conforme o estado do pagamento.

## Regra de segurança

Tokens secretos do PagBank nunca podem ficar em HTML, JavaScript público, GitHub Pages ou `js/env.js`. Eles devem ser armazenados como secrets das Supabase Edge Functions.

## Elegibilidade

A integração completa da API de pagamentos recorrentes depende da modalidade e aprovação da conta PagBank. Contas Pessoa Física devem utilizar Link de Pagamento Recorrente; a API de recorrência é destinada a contas Pessoa Jurídica aprovadas no onboarding do PagBank.

## Próximas definições necessárias

- confirmar se a conta PagBank é PF ou PJ;
- definir os planos e preços;
- definir quais recursos permanecem gratuitos;
- criar política de inadimplência, cancelamento e reembolso;
- solicitar e concluir homologação antes da produção automatizada.
