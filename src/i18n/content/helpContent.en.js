/* ══════════════════════════════════════════════
   juntos.cash — Help content: English
   Tutorial, FAQ, finance tips, and financing guide.
   Translated from helpContent.pt-BR.js (source of truth).
   ══════════════════════════════════════════════ */

export const TUTORIAL_STEPS = [
  {
    icon: 'house-line',
    title: 'Create or join a household',
    text: 'A "household" is the shared space where you and your partner organize your finances together. Whoever creates the household gets an invite code; the other person just needs to enter that code to join. If your partner doesn\'t want to create an account right now, you can add them as a manual partner in Settings.',
  },
  {
    icon: 'coins',
    title: 'Enter each person\'s income',
    text: 'In Settings, each person registers their own monthly income. That number is what the app uses to calculate the proportional split of expenses, so it\'s worth keeping it updated whenever your salary changes.',
  },
  {
    icon: 'credit-card',
    title: 'Log the couple\'s expenses',
    text: 'In the Expenses tab, log each expense with an amount, category, and who paid. Choose how it should be split: proportional to income, 50/50, or just one person (individual). The app automatically calculates how much each of you owes.',
  },
  {
    icon: 'package',
    title: 'Add installments and financing',
    text: 'Bought something in installments? On Pro, add simple installment plans and track their progress. SAC and Price, with a full amortization schedule, are part of Premium, which is still being prepared.',
  },
  {
    icon: 'chart-bar',
    title: 'Keep track from the home screen',
    text: 'The home screen summarizes the month: total spent, how much each of you paid, how much each of you should pay, and the balance between you. It\'s the first place to check whether things are settled.',
  },
  {
    icon: 'chart-line',
    title: 'Spot trends in Charts',
    text: 'Want to understand where the money is going? In Charts you can see how expenses evolve month by month, a ranking of categories, and a comparison between what each of you paid and what you should have paid.',
  },
];

export const FAQ_ITEMS = [
  {
    q: 'How does proportional splitting work?',
    a: 'The app adds up your income and your partner\'s and calculates each person\'s share. If you earn 60% of the couple\'s combined income, your proportional share of every shared expense is 60%, and your partner\'s is 40%. This updates automatically whenever the registered income changes.',
  },
  {
    q: 'My partner doesn\'t want to (or can\'t) create an account. Now what?',
    a: 'No problem. In Settings, under the Partner section, you can register a "manual partner": just their name and income. The app uses that data for calculations as usual, but you remain the one responsible for the actions.',
  },
  {
    q: 'Can I delete a transaction by mistake?',
    a: 'Only whoever paid can delete a transaction. This is intentional: it prevents one person from deleting an expense the other logged. The app always asks for confirmation before deleting anything.',
  },
  {
    q: 'What changes between the Free and Pro plans?',
    a: 'Free covers expenses and the dashboard. Pro adds simple installments, charts, one-off data export, and the financing guide. Premium, still unavailable for purchase, will add SAC, Price, and Open Finance. Your data is yours on every plan: on Free, the owner can download the history before closing the account; on Pro and Premium, export is also available anytime.',
  },
  {
    q: 'What is the household closing day for?',
    a: 'It defines when the month "rolls over" in reports. By default it\'s the last day of the current month, but you can set a fixed day (say, the 5th of every month) or a number of business days, which helps if your paycheck lands on varying dates.',
  },
  {
    q: 'Can other people see my data?',
    a: 'Only people in the same household (you and your partner) can see the registered transactions, installments, and income. Access is enforced by security rules at the database level, not just in the interface.',
  },
  {
    q: 'How do I switch between light and dark theme?',
    a: 'In Settings > Appearance, or via the sun/moon icon in the sidebar. There\'s also a "System" option, which automatically follows your phone\'s or computer\'s preference.',
  },
];

// Financing guide — exclusive to Pro/Premium subscribers (the 'guide'
// feature controls access, see src/services/subscription.js).
export const FINANCING_GUIDE = [
  {
    icon: 'plus-circle',
    title: 'How to add a new financing plan',
    text: 'Go to Installments and click "New installment plan". Choose the type: Installments for simple interest-free purchases, or SAC/Price for real financing (property, vehicle). Fill in the total amount, down payment, number of installments, and, for SAC/Price, the contract\'s annual interest rate.',
  },
  {
    icon: 'clock-counter-clockwise',
    title: 'How to add something already in progress',
    text: 'Already been paying off the financing for a while? In the new installment plan form, fill in the "Installments already paid" field with the number of installments settled so far. The app starts the progress right at the correct point, so you don\'t have to click "Pay installment" over and over just to catch it up.',
  },
  {
    icon: 'package',
    title: 'How simple installments work',
    text: 'This is the simplest model: interest-free, the installment is always the total amount divided by the number of installments. It works well for card installment purchases or interest-free agreements.',
  },
  {
    icon: 'house-line',
    title: 'How the SAC table works',
    text: 'SAC (Sistema de Amortização Constante — "Constant Amortization System") is a Brazilian amortization method: it has no exact equivalent name abroad, but the mechanism is straightforward. The amount amortized is the same every month, while interest is charged on the remaining balance, which keeps shrinking. The result: the installment starts higher and gradually decreases month by month until the end of the contract.',
  },
  {
    icon: 'car',
    title: 'How the Price table works',
    text: 'Price is Brazil\'s name for the French amortization system — the standard fixed-installment loan structure used internationally (in English, often just called an amortizing fixed-rate loan). The installment stays the same from start to finish, but its internal composition shifts: early on, most of it is interest; toward the end, most of it is principal repayment. What leaves your pocket each month never changes — only the breakdown behind it does.',
  },
  {
    icon: 'lightbulb',
    title: 'When each system tends to show up',
    text: 'In Brazil, SAC is common for mortgages (the declining installment weighs less later on) and Price tends to show up in vehicle financing. This isn\'t a fixed rule — each bank decides what it offers — but it helps you recognize which table your contract is likely using.',
  },
];

export const FINANCE_TIPS = [
  {
    icon: 'chats-circle',
    title: 'Talk about money before it becomes a problem',
    text: 'Couples who discuss finances regularly, not just when something goes wrong, tend to fight less over money. Set up a short monthly conversation to review expenses and align priorities, before the numbers turn into an unpleasant surprise.',
  },
  {
    icon: 'scales',
    title: 'Proportional isn\'t always 50/50, and that\'s fine',
    text: 'Splitting everything down the middle sounds fair, but it can weigh too heavily on whoever earns less. Splitting proportionally to income tends to be more sustainable long-term: each person contributes according to what they earn, and no one goes into the red just to cover the couple\'s bills.',
  },
  {
    icon: 'piggy-bank',
    title: 'Keep an emergency fund as a couple',
    text: 'Before investing or making ambitious plans, set aside three to six months of basic expenses somewhere easy to access. That way, an unexpected event — a layoff, an expensive repair — doesn\'t turn into a financial crisis from scratch.',
  },
  {
    icon: 'target',
    title: 'Set goals with a deadline, not just wishes',
    text: '"Save more" isn\'t a goal, it\'s an intention. "Save $500 a month toward a down payment on an apartment in two years" is a goal. The more concrete the goal, the easier it is to track progress and celebrate when you reach it.',
  },
  {
    icon: 'eye',
    title: 'Full transparency avoids distrust',
    text: 'Hidden expenses, even small ones, erode trust once discovered. Logging everything in the same place, even that snack you grabbed on the street, keeps things clear and avoids the feeling that someone is withholding information.',
  },
  {
    icon: 'calendar-check',
    title: 'Review together every month, even briefly',
    text: 'It doesn\'t need to be a formal meeting. Ten minutes looking at the month\'s summary — what was spent, what\'s left, what\'s coming — already helps you catch problems early and adjust the budget before it gets out of hand.',
  },
  {
    icon: 'handshake',
    title: 'Big financing decisions deserve a joint decision',
    text: 'Before taking on long-term financing, simulate its monthly impact on the couple\'s income together. An installment that looks small on its own can add up a lot once stacked on top of everything else you\'re already committed to.',
  },
];
