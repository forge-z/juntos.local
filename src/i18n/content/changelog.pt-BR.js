/* ══════════════════════════════════════════════
   juntos.cash — Changelog: Português (Brasil)
   Fonte da verdade — en.js/es.js são traduções deste conteúdo.
   ══════════════════════════════════════════════ */

export const APP_VERSION = '1.0.0';

export const CHANGELOG = [
  {
    version: '1.0.0',
    date: '2026-07-20',
    label: 'Preparação para o lançamento',
    fixes: [
      'Corrigida falha de build causada por dependências desatualizadas',
      'Fechado acesso público desnecessário a uma rotina interna de manutenção',
    ],
    features: [],
  },
  {
    version: '0.2.0',
    date: '2026-07-04',
    label: 'Tema claro, configurações reorganizadas e ajuda no app',
    fixes: [
      'Cards da tela inicial agora usam a mesma grade em cima e embaixo, sem desalinhamento entre as linhas',
      'Corrigido contraste de textos no tema claro (nomes e valores que ficavam quase invisíveis sobre o fundo)',
      'Rótulos de mês nos gráficos agora mostram mês e ano na mesma linha, sem quebra estranha',
      'Página de Configurações ocupa a largura correta da tela, como as demais páginas',
    ],
    features: [
      'Tema claro e escuro, com opção de seguir automaticamente o sistema (em Configurações > Aparência)',
      'Configurações reorganizada em Perfil, Parceiro(a), Lar e Aparência, cada informação no lugar certo',
      'Plano Pro liberado para todos durante os testes, direto em Configurações > Perfil',
      'Novo gráfico consolidando parcelas contratadas com a média de gastos dos últimos meses',
      'Tutorial, Perguntas frequentes e Dicas financeiras para casais, agora dentro do próprio app',
      'Selo de versão e novidades movido para o fim de Configurações',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-07-03',
    label: 'Primeiro lançamento',
    fixes: [
      'Corrigido cálculo de saldo no Dashboard quando usando divisão proporcional',
      'Corrigida listagem de transações mostrando pagador correto (paid_by_manual)',
      'Corrigida atualização de transação mantendo o pagador selecionado no formulário',
      'Corrigido fallback do RPC de exclusão de transação usando parâmetro correto',
      'Adicionada proteção contra divisão por zero ao exibir valor de parcela',
      'Corrigidos erros que usavam innerHTML sem escape de mensagens',
    ],
    features: [
      'Tela inicial com visão geral do mês, saldo por pessoa e categorias',
      'Gestão de gastos compartilhados com divisão proporcional, 50/50 ou individual',
      'Financiamentos e parcelas com acompanhamento de progresso',
      'Gráficos mensais, por categoria e projeção de parcelas',
      'Tabelas de amortização SAC e Price',
      'Sistema de planos (Gratuito / Pro / Premium)',
      'Configurações de perfil, lar e métodos de pagamento',
    ],
  },
];
