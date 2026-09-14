// 房貸與資產成長試算邏輯

function fmt(n) {
  return Number(n).toLocaleString("zh-Hant-TW", { maximumFractionDigits: 1 });
}

function calcLoanSchedule(loanAmount, annualRatePct, years, type) {
  const months = years * 12;
  const monthlyRate = annualRatePct / 100 / 12;
  const schedule = []; // { month, payment, principal, interest, balance }
  let balance = loanAmount;

  let paidSoFar = 0;

  if (monthlyRate === 0) {
    const principalPerMonth = loanAmount / months;
    for (let m = 1; m <= months; m++) {
      balance -= principalPerMonth;
      paidSoFar += principalPerMonth;
      schedule.push({ month: m, payment: principalPerMonth, principal: principalPerMonth, interest: 0, balance: Math.max(balance, 0), paidSoFar });
    }
    return schedule;
  }

  if (type === "equalPayment") {
    const payment =
      (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    for (let m = 1; m <= months; m++) {
      const interest = balance * monthlyRate;
      const principal = payment - interest;
      balance -= principal;
      paidSoFar += payment;
      schedule.push({ month: m, payment, principal, interest, balance: Math.max(balance, 0), paidSoFar });
    }
  } else {
    const principalPerMonth = loanAmount / months;
    for (let m = 1; m <= months; m++) {
      const interest = balance * monthlyRate;
      const payment = principalPerMonth + interest;
      balance -= principalPerMonth;
      paidSoFar += payment;
      schedule.push({ month: m, payment, principal: principalPerMonth, interest, balance: Math.max(balance, 0), paidSoFar });
    }
  }
  return schedule;
}

function renderLoanResult(schedule, loanAmount) {
  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = totalPayment - loanAmount;
  const firstMonthPayment = schedule[0].payment;

  const el = document.getElementById("loanResult");
  el.innerHTML = `
    <div class="stat"><div class="label">首月月付金（萬元）</div><div class="value">${fmt(firstMonthPayment)}</div></div>
    <div class="stat"><div class="label">總繳金額（萬元）</div><div class="value">${fmt(totalPayment)}</div></div>
    <div class="stat"><div class="label">總利息（萬元）</div><div class="value">${fmt(totalInterest)}</div></div>
  `;
}

function simulateAssets(params) {
  const {
    loanSchedule,
    currentCash,
    currentStock,
    monthlyCash,
    cashGrowthRatePct,
    monthlyStock,
    stockGrowthRatePct,
    simMonths,
    housePrice,
  } = params;

  const monthlyCashRate = cashGrowthRatePct / 100 / 12;
  const monthlyStockRate = stockGrowthRatePct / 100 / 12;

  let cash = currentCash;
  let stock = currentStock;
  const rows = []; // per month
  const totalPaid = loanSchedule.length ? loanSchedule[loanSchedule.length - 1].paidSoFar : 0;

  for (let m = 1; m <= simMonths; m++) {
    cash = cash * (1 + monthlyCashRate) + monthlyCash;
    stock = stock * (1 + monthlyStockRate) + monthlyStock;
    const loanBalance = m <= loanSchedule.length ? loanSchedule[m - 1].balance : 0;
    const loanPaid = m <= loanSchedule.length ? loanSchedule[m - 1].paidSoFar : totalPaid;
    const netWorth = cash + stock + housePrice - loanBalance;
    rows.push({ month: m, cash, stock, loanBalance, loanPaid, netWorth });
  }
  return rows;
}

let chartInstance = null;

function renderChart(rows) {
  const years = rows.filter((r) => r.month % 12 === 0);
  const labels = years.map((r) => `第${r.month / 12}年`);
  const loanData = years.map((r) => r.loanBalance);
  const cashData = years.map((r) => r.cash);
  const stockData = years.map((r) => r.stock);
  const netData = years.map((r) => r.netWorth);

  const ctx = document.getElementById("chart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "房貸剩餘", data: loanData, borderColor: "#e53e3e", backgroundColor: "transparent", tension: 0.2 },
        { label: "累積現金", data: cashData, borderColor: "#3182ce", backgroundColor: "transparent", tension: 0.2 },
        { label: "累積股票", data: stockData, borderColor: "#38a169", backgroundColor: "transparent", tension: 0.2 },
        { label: "淨資產", data: netData, borderColor: "#805ad5", backgroundColor: "transparent", tension: 0.2, borderWidth: 3 },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { title: { display: true, text: "萬元" } },
      },
    },
  });
}

function renderYearlyTable(rows) {
  const tbody = document.querySelector("#yearlyTable tbody");
  tbody.innerHTML = "";
  rows
    .filter((r) => r.month % 12 === 0)
    .forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>第 ${r.month / 12} 年</td>
        <td>${fmt(r.loanBalance)}</td>
        <td>${fmt(r.loanPaid)}</td>
        <td>${fmt(r.cash)}</td>
        <td>${fmt(r.stock)}</td>
        <td>${fmt(r.netWorth)}</td>
      `;
      tbody.appendChild(tr);
    });
}

function renderSummary(rows, simYears) {
  const last = rows[rows.length - 1];
  const el = document.getElementById("summaryResult");
  el.innerHTML = `
    <div class="stat"><div class="label">第 ${simYears} 年房貸剩餘（萬元）</div><div class="value">${fmt(last.loanBalance)}</div></div>
    <div class="stat"><div class="label">第 ${simYears} 年房貸已繳金額（萬元）</div><div class="value">${fmt(last.loanPaid)}</div></div>
    <div class="stat"><div class="label">第 ${simYears} 年累積現金（萬元）</div><div class="value">${fmt(last.cash)}</div></div>
    <div class="stat"><div class="label">第 ${simYears} 年累積股票（萬元）</div><div class="value">${fmt(last.stock)}</div></div>
    <div class="stat"><div class="label">第 ${simYears} 年淨資產（萬元）</div><div class="value">${fmt(last.netWorth)}</div></div>
  `;
}

function updateLoanAmount() {
  const housePrice = parseFloat(document.getElementById("housePrice").value) || 0;
  const downPayment = parseFloat(document.getElementById("downPayment").value) || 0;
  const loanAmount = Math.max(housePrice - downPayment, 0);
  document.getElementById("loanAmount").value = loanAmount;
  return loanAmount;
}

function runCalculation() {
  const loanAmount = updateLoanAmount();
  const loanRate = parseFloat(document.getElementById("loanRate").value) || 0;
  const loanYears = parseInt(document.getElementById("loanYears").value) || 1;
  const repayType = document.getElementById("repayType").value;

  const currentCash = parseFloat(document.getElementById("currentCash").value) || 0;
  const currentStock = parseFloat(document.getElementById("currentStock").value) || 0;

  const monthlyCash = parseFloat(document.getElementById("monthlyCash").value) || 0;
  const cashGrowthRate = parseFloat(document.getElementById("cashGrowthRate").value) || 0;
  const monthlyStock = parseFloat(document.getElementById("monthlyStock").value) || 0;
  const stockGrowthRate = parseFloat(document.getElementById("stockGrowthRate").value) || 0;
  const simYears = parseInt(document.getElementById("simYears").value) || 1;

  const loanSchedule = calcLoanSchedule(loanAmount, loanRate, loanYears, repayType);
  renderLoanResult(loanSchedule, loanAmount);

  const housePrice = parseFloat(document.getElementById("housePrice").value) || 0;

  const simMonths = simYears * 12;
  const rows = simulateAssets({
    loanSchedule,
    currentCash,
    currentStock,
    monthlyCash,
    cashGrowthRatePct: cashGrowthRate,
    monthlyStock,
    stockGrowthRatePct: stockGrowthRate,
    simMonths,
    housePrice,
  });

  renderSummary(rows, simYears);
  renderChart(rows);
  renderYearlyTable(rows);
}

document.getElementById("calcBtn").addEventListener("click", runCalculation);
document.getElementById("housePrice").addEventListener("input", updateLoanAmount);
document.getElementById("downPayment").addEventListener("input", updateLoanAmount);
document.addEventListener("DOMContentLoaded", runCalculation);
