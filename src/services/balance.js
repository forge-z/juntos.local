import { centsToMoney, moneyToCents } from '../pages/_helpers.js';

export function calculateContribution(
  records,
  userId,
  myIncome = 0,
  partnerIncome = 0,
  {
    getAmount = (record) => record.amount,
    getPayer = (record) => record.paid_by_manual || record.paid_by,
  } = {},
) {
  const myIncomeValue = Math.max(moneyToCents(myIncome), 0);
  const partnerIncomeValue = Math.max(moneyToCents(partnerIncome), 0);
  const totalIncome = myIncomeValue + partnerIncomeValue;
  const myRatio = totalIncome > 0 ? myIncomeValue / totalIncome : 0.5;

  let myPaid = 0;
  let partnerPaid = 0;
  let myExpected = 0;
  let partnerExpected = 0;

  for (const record of records) {
    const amount = Math.max(moneyToCents(getAmount(record)), 0);
    const isMine = getPayer(record) === userId;

    if (isMine) myPaid += amount;
    else partnerPaid += amount;

    if (record.split_type === 'individual') {
      if (isMine) myExpected += amount;
      else partnerExpected += amount;
    } else if (record.split_type === 'proportional') {
      // Calcula um lado e atribui o restante ao outro para preservar a
      // soma exata em centavos (inclusive para valores ímpares).
      const myAmount = Math.round(amount * myRatio);
      myExpected += myAmount;
      partnerExpected += amount - myAmount;
    } else {
      myExpected += Math.round(amount / 2);
      partnerExpected += amount - Math.round(amount / 2);
    }
  }

  return {
    myPaid: centsToMoney(myPaid),
    partnerPaid: centsToMoney(partnerPaid),
    myExpected: centsToMoney(myExpected),
    partnerExpected: centsToMoney(partnerExpected),
    myBalance: centsToMoney(myPaid - myExpected),
    partnerBalance: centsToMoney(partnerPaid - partnerExpected),
    total: centsToMoney(myPaid + partnerPaid),
  };
}
