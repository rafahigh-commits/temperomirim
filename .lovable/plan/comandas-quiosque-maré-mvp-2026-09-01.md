# Comandas Quiosque Maré — MVP

App web/PWA de comandas, otimizado para toque em celular e tablet, com Lovable Cloud (banco + login).

## Fluxo principal (prioridade 1)

Abrir conta → lançar produtos → acompanhar total → fechar conta com pagamento → ver no fechamento do dia.

## Telas

1. **Login** (`/auth`) — e-mail e senha. Perfis: `atendente` e `admin`.
2. **Início** (`/`) — botão grande "ABRIR NOVA CONTA" e lista de contas abertas em cartões: mesa (se houver), nome do cliente, celular, valor acumulado e hora de abertura. Toque no cartão continua a conta. Só para admin: total vendido no dia, contas abertas e contas fechadas.
3. **Abrir conta** — celular (obrigatório), nome (obrigatório), mesa/comanda (opcional). Bloqueia se já existir conta aberta com o mesmo celular, e também com a mesma mesa quando informada. Registra data/hora e status "Aberta".
4. **Conta aberta** — categorias com botões grandes de produtos; um toque adiciona com quantidade 1 e preço atual. Itens listados com + / − , remover (com confirmação) e observação opcional. Total sempre fixo no rodapé, junto do botão "FECHAR CONTA".
5. **Fechar conta** — resumo dos itens, subtotal, campo de desconto em R$, total final, escolha de pagamento (Dinheiro, Pix, Débito, Crédito) e confirmação obrigatória. Sem forma de pagamento não fecha. Grava hora do fechamento, totais, desconto, pagamento e usuário responsável; a conta sai da lista de abertas.
6. **Produtos** (admin) — cadastrar/editar produto (nome, categoria, preço, ativo/inativo) e cadastrar/editar categorias. Produtos inativos não aparecem para lançamento.
7. **Fechamento do dia** (admin) — total vendido, contas fechadas, totais por Dinheiro/Pix/Débito/Crédito, total de descontos, ticket médio e lista Horário | Mesa | Total | Pagamento com detalhe da venda.
8. **Histórico** (admin) — filtros hoje, ontem, período e forma de pagamento; somente leitura.
9. **Configurações** (admin) — nome do estabelecimento ("Quiosque Maré") e upload de logotipo, usados no cabeçalho e no PWA.

## Regras aplicadas

- Preço e nome do produto são copiados para o item no momento do lançamento; contas fechadas nunca mudam de valor.
- Valores em `numeric(10,2)` no banco e cálculo em centavos na interface.
- Vendas fechadas não são editadas nem apagadas.
- Vários atendentes na mesma conta: itens são gravados linha por linha no banco, com atualização em tempo real na tela da conta, sem sobrescrever lançamentos de outra pessoa.
- Confirmação antes de fechar conta e antes de remover item.

## Dados de exemplo

Bebidas (Cerveja R$ 12,00 · Água R$ 5,00 · Refrigerante R$ 8,00) e Comidas (Porção R$ 35,00 · Hambúrguer R$ 28,00), editáveis em Produtos.

## Detalhes técnicos

- Tabelas: `profiles`, `user_roles` (+ função `has_role`), `categories`, `products`, `accounts`, `account_items`, `sales`, `settings`. RLS: atendentes autenticados operam contas/itens; produtos, fechamento, histórico e configurações restritos a admin; leitura de produtos liberada a autenticados.
- Storage bucket público para o logotipo.
- Realtime nas contas e itens para concorrência de lançamentos.
- PWA instalável: manifest, ícones e tema (sem modo offline nesta versão).
- Primeiro usuário cadastrado recebe papel admin; os demais entram como atendente e podem ser promovidos por um admin.

## Fora do MVP

Estoque, nota fiscal, maquininha, impressora, divisão de conta, delivery, cadastro complexo de clientes e controle financeiro avançado.
