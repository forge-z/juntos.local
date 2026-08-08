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
  const myIncomeValue = Math.max(Number(myIncome) || 0, 0);
  const partnerIncomeValue = Math.max(Number(partnerIncome) || 0, 0);
  const totalIncome = myIncomeValue + partnerIncomeValue;
  const myRatio = totalIncome > 0 ? myIncomeValue / totalIncome : 0.5;
  const partnerRatio = totalIncome > 0 ? partnerIncomeValue / totalIncome : 0.5;

  let myPaid = 0;
  let partnerPaid = 0;
  let myExpected = 0;
  let partnerExpected = 0;

  for (const record of records) {
    const amount = Math.max(Number(getAmount(record)) || 0, 0);
    const isMine = getPayer(record) === userId;

    if (isMine) myPaid += amount;
    else partnerPaid += amount;

    if (record.split_type === 'individual') {
      if (isMine) myExpected += amount;
      else partnerExpected += amount;
    } else if (record.split_type === 'proportional') {
      myExpected += amount * myRatio;
      partnerExpected += amount * partnerRatio;
    } else {
      myExpected += amount / 2;
      partnerExpected += amount / 2;
    }
  }

  return {
    myPaid,
    partnerPaid,
    myExpected,
    partnerExpected,
    myBalance: myPaid - myExpected,
    partnerBalance: partnerPaid - partnerExpected,
    total: myPaid + partnerPaid,
  };
}
