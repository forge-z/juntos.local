/* ══════════════════════════════════════════════
   juntos.cash — Conteúdo de ajuda: Português (Brasil)
   Tutorial, FAQ, dicas financeiras e guia de financiamentos.
   Fonte da verdade — en.js/es.js são traduções deste conteúdo.
   ══════════════════════════════════════════════ */

export const TUTORIAL_STEPS = [
  {
    icon: 'house-line',
    title: 'Crie ou entre em um lar',
    text: 'Um "lar" é o espaço onde você e seu par organizam as finanças juntos. Quem cria o lar define um código de convite; a outra pessoa só precisa digitar esse código para entrar. Se o parceiro não quiser criar conta agora, dá para cadastrá-lo como parceiro manual em Configurações.',
  },
  {
    icon: 'coins',
    title: 'Informe a renda de cada um',
    text: 'Em Configurações, cada pessoa registra a própria renda mensal. É esse número que o app usa para calcular a divisão proporcional dos gastos, então vale a pena manter atualizado quando o salário mudar.',
  },
  {
    icon: 'credit-card',
    title: 'Lance os gastos do casal',
    text: 'Na aba Gastos, registre cada despesa com valor, categoria e quem pagou. Escolha como ela deve ser dividida: proporcional à renda, 50/50 ou só de uma pessoa (individual). O app calcula automaticamente quanto cada um deve.',
  },
  {
    icon: 'package',
    title: 'Cadastre parcelas e financiamentos',
    text: 'Comprou algo parcelado? No Pro, cadastre parcelas simples e acompanhe o progresso. SAC e Price, com tabela de amortização, fazem parte do Premium, que ainda está em preparação.',
  },
  {
    icon: 'chart-bar',
    title: 'Acompanhe pela tela inicial',
    text: 'A tela inicial resume o mês: total gasto, quanto cada um pagou, quanto deveria pagar e o saldo entre vocês. É o primeiro lugar para checar se as contas estão em dia.',
  },
  {
    icon: 'chart-line',
    title: 'Analise tendências em Gráficos',
    text: 'Quer entender para onde o dinheiro está indo? Em Gráficos você vê a evolução dos gastos mês a mês, o ranking de categorias e a comparação entre o que cada um pagou e o que deveria ter pago.',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'Como funciona a divisão proporcional?',
    a: 'O app soma a renda de você e do seu parceiro e calcula a proporção de cada um. Se você ganha 60% da renda do casal, sua parte proporcional em cada gasto compartilhado é 60%, e a do parceiro, 40%. Isso muda automaticamente sempre que a renda cadastrada é atualizada.',
  },
  {
    q: 'Meu parceiro não quer (ou não pode) criar conta. E agora?',
    a: 'Sem problema. Em Configurações, na seção Parceiro, você pode cadastrar um "parceiro manual": só o nome e a renda dele. O app usa esses dados para os cálculos normalmente, mas quem responde pelas ações continua sendo você.',
  },
  {
    q: 'Posso remover uma transação por engano?',
    a: 'Só quem pagou pode excluir a transação. Isso é intencional: evita que uma pessoa apague um gasto que a outra registrou. Ao clicar em excluir, o app sempre pede confirmação antes.',
  },
  {
    q: 'O que muda entre os planos Gratuito e Pro?',
    a: 'O Gratuito cobre gastos e dashboard. O Pro acrescenta parcelas simples, gráficos, exportação avulsa e o guia de financiamentos. O Premium, ainda indisponível para compra, acrescentará SAC, Price e Open Finance. Seus dados são seus em qualquer plano: no Gratuito, o titular pode baixar o histórico antes de encerrar a conta; no Pro e Premium, a exportação também fica disponível a qualquer momento.',
  },
  {
    q: 'Para que serve o dia de fechamento do lar?',
    a: 'Ele define quando o mês "vira" nos relatórios. Por padrão é o último dia do mês corrente, mas dá para configurar um dia fixo (por exemplo, todo dia 5) ou um número de dias úteis, o que ajuda quem recebe salário em datas variáveis.',
  },
  {
    q: 'Meus dados são visíveis para outras pessoas?',
    a: 'Só quem está no mesmo lar (você e seu parceiro) enxerga as transações, parcelas e rendas cadastradas. O acesso é controlado por regras de segurança no banco de dados, não só na tela.',
  },
  {
    q: 'Como troco entre tema claro e escuro?',
    a: 'Em Configurações > Aparência, ou pelo ícone de sol/lua na barra lateral. Também tem a opção "Sistema", que segue automaticamente a preferência do seu celular ou computador.',
  },
];

// Guia de financiamentos — exclusivo para assinantes Pro/Premium
// (a feature 'guide' controla o acesso, ver src/services/subscription.js).
export const FINANCING_GUIDE = [
  {
    icon: 'plus-circle',
    title: 'Como lançar um financiamento novo',
    text: 'Vá em Parcelas e clique em "Nova parcela". Escolha o tipo: Parcelado para compras simples sem juros, ou SAC/Price para financiamentos de verdade (imóvel, veículo). Preencha valor total, entrada, número de parcelas e, no caso de SAC/Price, a taxa de juros anual do contrato.',
  },
  {
    icon: 'clock-counter-clockwise',
    title: 'Como lançar algo que já está em andamento',
    text: 'Já vem pagando o financiamento há um tempo? No formulário de nova parcela, preencha o campo "Parcelas já pagas" com o número de parcelas quitadas até hoje. O app começa o progresso direto do ponto certo, sem você precisar clicar em "Pagar parcela" um monte de vezes só para colocar em dia.',
  },
  {
    icon: 'package',
    title: 'Como funciona o Parcelado',
    text: 'É o modelo mais simples: sem juros, a parcela é sempre o valor total dividido pelo número de parcelas. Serve bem para compras parceladas no cartão ou acordos sem cobrança de juros.',
  },
  {
    icon: 'house-line',
    title: 'Como funciona a Tabela SAC',
    text: 'Na SAC (Sistema de Amortização Constante), o valor amortizado é igual todo mês, mas os juros incidem sobre o saldo devedor, que vai caindo. Resultado: a parcela começa mais alta e vai diminuindo mês a mês até o fim do contrato.',
  },
  {
    icon: 'car',
    title: 'Como funciona a Tabela Price',
    text: 'Na Price, a parcela é fixa do início ao fim, mas a composição interna muda: no começo, a maior parte é juros; perto do final, a maior parte é amortização do saldo devedor. O valor que sai do seu bolso todo mês não muda, só a "receita" por trás dele.',
  },
  {
    icon: 'lightbulb',
    title: 'Quando cada sistema costuma aparecer',
    text: 'No Brasil, SAC é comum em financiamento imobiliário (a parcela decrescente pesa menos lá na frente) e Price costuma aparecer em financiamento de veículos. Isso não é uma regra fixa, cada banco define o que oferece, mas ajuda a reconhecer qual tabela seu contrato provavelmente usa.',
  },
];

export const FINANCE_TIPS = [
  {
    icon: 'chats-circle',
    title: 'Conversem sobre dinheiro antes que vire problema',
    text: 'Casais que discutem finanças regularmente, não só quando algo dá errado, tendem a brigar menos por causa de dinheiro. Combine uma conversa curta por mês para revisar gastos e alinhar prioridades, antes que os números virem uma surpresa desagradável.',
  },
  {
    icon: 'scales',
    title: 'Proporcional nem sempre é 50/50, e tudo bem',
    text: 'Dividir tudo ao meio parece justo, mas pode pesar demais para quem ganha menos. A divisão proporcional à renda costuma ser mais sustentável a longo prazo: cada um contribui de acordo com o que ganha, e ninguém fica no vermelho para pagar as contas do casal.',
  },
  {
    icon: 'piggy-bank',
    title: 'Tenham uma reserva de emergência do casal',
    text: 'Antes de investir ou fazer planos ambiciosos, guardem de três a seis meses de despesas básicas em um lugar de fácil acesso. Isso evita que um imprevisto, uma demissão ou um conserto caro, vire uma crise financeira do zero.',
  },
  {
    icon: 'target',
    title: 'Definam metas com prazo, não só desejos',
    text: '"Economizar mais" não é uma meta, é uma intenção. "Guardar R$ 500 por mês para dar entrada num apartamento em dois anos" é uma meta. Quanto mais concreta a meta, mais fácil é acompanhar o progresso e comemorar quando ela é alcançada.',
  },
  {
    icon: 'eye',
    title: 'Transparência total evita desconfiança',
    text: 'Gastos escondidos, mesmo os pequenos, corroem a confiança quando descobertos. Registrar tudo no mesmo lugar, inclusive aquele lanche na rua, mantém as contas claras e evita a sensação de que alguém está sonegando informação.',
  },
  {
    icon: 'calendar-check',
    title: 'Revisem juntos todo mês, mesmo que rápido',
    text: 'Não precisa ser uma reunião formal. Dez minutos olhando o resumo do mês, o que foi gasto, o que sobrou, o que está por vir, já ajudam a pegar problemas cedo e a ajustar o orçamento antes que ele saia do controle.',
  },
  {
    icon: 'handshake',
    title: 'Financiamentos grandes merecem decisão conjunta',
    text: 'Antes de assumir um financiamento de longo prazo, simulem juntos o impacto mensal na renda do casal. Uma parcela que parece pequena isolada pode apertar bastante quando somada a tudo o mais que já está comprometido.',
  },
];
