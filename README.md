# Kiosk Flow

Quero criar um sistema web/PWA simples de controle de contas para um quiosque.

O objetivo é substituir uma comanda manual. O sistema deve permitir:

ABRIR CONTA → LANÇAR PRODUTOS → ACOMPANHAR CONSUMO → FECHAR CONTA → REGISTRAR PAGAMENTO → CONSULTAR FECHAMENTO DO DIA.

Quero uma interface extremamente simples, rápida e pensada para uso em celular ou tablet no atendimento.

## 1. TELA INICIAL

Criar um dashboard com:

- botão "ABRIR NOVA CONTA";

- lista de contas abertas;

- número da mesa/comanda;

- nome do cliente, se informado;

- valor acumulado;

- horário de abertura;

- botão para abrir/continuar a conta.

Também mostrar(somente Admin):

- total vendido no dia;

- quantidade de contas abertas;

- quantidade de contas fechadas.

## 2. ABRIR CONTA

Ao clicar em "Abrir Nova Conta":

- informar número do celular;

- nome do cliente;

- registrar data e hora de abertura;

- criar conta com status "Aberta".

Não permitir duas contas abertas utilizando o mesmo número de celular.

## 3. CONTA ABERTA

Criar uma tela simples para lançamento de produtos.

Mostrar categorias e produtos em botões grandes, adequados para tablet/celular.

Exemplo:

BEBIDAS

[ Cerveja ]

[ Água ]

[ Refrigerante ]

COMIDAS

[ Porção ]

[ Hambúrguer ]

Ao tocar em um produto:

- adicionar o produto à conta;

- utilizar o preço atual cadastrado;

- quantidade inicial = 1.

Permitir:

- aumentar quantidade;

- diminuir quantidade;

- remover produto;

- adicionar observação opcional ao item.

Mostrar sempre o total da conta.

Exemplo:

Cerveja       3 x R$ 12,00 = R$ 36,00

Água          2 x R$ 5,00  = R$ 10,00

Porção        1 x R$ 35,00 = R$ 35,00

TOTAL: R$ 81,00

## 4. PREÇOS

O preço deve ser armazenado no item da venda no momento em que o produto é adicionado.

Isso é importante para que, se o preço do produto mudar depois, contas antigas não sejam alteradas.

## 5. CADASTRO DE PRODUTOS

Criar uma área "Produtos".

Permitir:

- cadastrar produto;

- editar produto;

- ativar/inativar produto;

- definir categoria;

- definir preço atual.

Campos:

- Nome;

- Categoria;

- Preço;

- Ativo/Inativo.

Produtos inativos não devem aparecer para lançamento nas novas contas.

Categorias também devem poder ser cadastradas/editadas.

## 6. FECHAR CONTA

Na conta aberta, criar botão:

"FECHAR CONTA"

Ao clicar:

Mostrar resumo:

- produtos;

- quantidades;

- valores;

- subtotal;

- desconto, se houver;

- total final.

Permitir selecionar forma de pagamento:

- Dinheiro;

- Pix;

- Débito;

- Crédito.

Registrar:

- data/hora do fechamento;

- valor total;

- forma de pagamento;

- usuário responsável, se houver.

Depois da confirmação:

STATUS = FECHADA

A conta não deve mais aparecer entre as contas abertas.

## 7. DESCONTO

Permitir desconto opcional no fechamento.

Inicialmente permitir desconto em valor absoluto.

Exemplo:

Subtotal: R$ 100,00

Desconto: R$ 10,00

Total: R$ 90,00

Registrar o desconto junto com a venda.

## 8. FECHAMENTO DO DIA (Somente visualizado por quem tiver perfil de Admin)

Criar uma tela "Fechamento do Dia".

Mostrar:

- total vendido;

- quantidade de contas fechadas;

- vendas em dinheiro;

- vendas via Pix;

- vendas no débito;

- vendas no crédito;

- total de descontos;

- ticket médio.

Também mostrar uma lista das contas fechadas:

Horário | Mesa | Total | Pagamento

Permitir selecionar uma venda e visualizar seus detalhes.

## 9. HISTÓRICO

Criar tela de histórico de vendas.

Permitir filtrar por:

- hoje;

- ontem;

- período;

- forma de pagamento.

Não permitir alterar vendas já fechadas nesta primeira versão.

## 10. BANCO DE DADOS

Utilizar Supabase para persistência dos dados.

Criar estrutura adequada para:

- produtos;

- categorias;

- contas;

- itens das contas;

- pagamentos/vendas;

- usuários, se necessário.

Relacionamentos devem ser corretamente definidos.

Uma conta possui vários itens.

Cada item pertence a um produto, mas deve guardar também o nome e preço praticado no momento da venda.

## 11. PWA

O sistema deve ser responsivo e funcionar muito bem em:

- celular;

- tablet;

- computador.

Preparar como PWA instalável.

A interface deve priorizar toque, com botões grandes e navegação rápida.

## 12. DESIGN

Quero um visual moderno, limpo e muito simples.

Priorizar:

- poucos cliques;

- números e valores fáceis de visualizar;

- botões grandes;

- boa leitura em ambiente de atendimento;

- navegação rápida.

Não criar telas desnecessárias.

O sistema não precisa parecer um ERP. Deve parecer um aplicativo simples de comandas.

## 13. PRIMEIRA VERSÃO

NÃO implementar nesta primeira versão:

- estoque;

- emissão de nota fiscal;

- integração com maquininha;

- integração bancária;

- NFC-e;

- impressora;

- divisão de conta;

- delivery;

- cadastro complexo de clientes;

- controle financeiro avançado.

Quero somente:

ABRIR CONTA

→ LANÇAR PRODUTOS

→ ACOMPANHAR CONSUMO

→ FECHAR CONTA

→ REGISTRAR PAGAMENTO

→ FECHAMENTO DO DIA

→ HISTÓRICO.

## 14. REGRAS IMPORTANTES

- Valores monetários devem utilizar tipo numérico adequado, evitando problemas de arredondamento.

- Uma conta aberta não pode ser fechada sem forma de pagamento.

- Contas fechadas devem preservar os preços praticados no momento da venda.

- Produtos inativos não aparecem para novas vendas.

- Não permitir conta duplicada para a mesma mesa/comanda enquanto houver uma conta aberta.

- Exigir confirmação antes de fechar uma conta.

- Exigir confirmação antes de excluir/remover itens relevantes.

- Não apagar vendas fechadas do banco de dados.

- Registrar data e hora de abertura e fechamento.

- É importante que o sistema esteja preparado para concorrência de lançamentos, pois mais de uma pessoa pode lançar em uma conta aberta

## 15. OBJETIVO DO MVP

Ao finalizar, quero conseguir fazer exatamente isto:

1. Abrir o aplicativo.

2. Clicar em "ABRIR NOVA CONTA".

3. Escolher Mesa 01.

4. Adicionar 3 cervejas.

5. Adicionar 1 porção.

6. Visualizar o total.

7. Fechar a conta.

8. Escolher Pix.

9. Confirmar.

10. Ver a venda no fechamento do dia.

Antes de implementar funcionalidades adicionais, priorize esse fluxo principal e garanta que ele funcione corretamente de ponta a ponta.

Deixe o sistema preparado para configurar o nome e logotipo do estabelecimento.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://quiosquemare.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5c27126d-15ee-4397-a236-795f54fcb111).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
