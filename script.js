// 房貸與資產成長試算邏輯

const MEMORY_COOKIE = "homeLoanCalculator";
const MEMORY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const TARGET_HOUSES_STORAGE_KEY = "homeLoanTargetHouses";
const rememberedFieldIds = [
  "housePrice", "downPayment", "loanRate", "loanYears", "repayType", "dtiRatio",
  "currentCash", "currentStock", "monthlyCash", "cashGrowthRate", "monthlyStock",
  "stockGrowthRate", "simYears",
];

function loadRememberedInputs() {
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${MEMORY_COOKIE}=`));
  if (!cookie) return false;

  try {
    const values = JSON.parse(decodeURIComponent(cookie.slice(MEMORY_COOKIE.length + 1)));
    rememberedFieldIds.forEach((id) => {
      if (values[id] !== undefined) document.getElementById(id).value = values[id];
    });
    return true;
  } catch {
    return false;
  }
}

function saveRememberedInputs() {
  const values = Object.fromEntries(
    rememberedFieldIds.map((id) => [id, document.getElementById(id).value])
  );
  document.cookie = `${MEMORY_COOKIE}=${encodeURIComponent(JSON.stringify(values))}; Max-Age=${MEMORY_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
  document.getElementById("memoryStatus").textContent = "設定已儲存於此瀏覽器 Cookie。";
}

function clearRememberedInputs() {
  document.cookie = `${MEMORY_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  document.getElementById("memoryStatus").textContent = "已清除記憶；目前欄位值不變。";
}

function loadTargetHouses() {
  try {
    const houses = JSON.parse(localStorage.getItem(TARGET_HOUSES_STORAGE_KEY) || "[]");
    return Array.isArray(houses) ? houses : [];
  } catch {
    return [];
  }
}

function saveTargetHouses(houses) {
  try {
    localStorage.setItem(TARGET_HOUSES_STORAGE_KEY, JSON.stringify(houses));
    return true;
  } catch {
    document.getElementById("targetHouseStatus").textContent = "無法儲存清單，請檢查瀏覽器儲存空間設定。";
    return false;
  }
}

function renderTargetHouses() {
  const list = document.getElementById("targetHouseList");
  const houses = loadTargetHouses();
  list.replaceChildren();

  houses.forEach((house, index) => {
    const item = document.createElement("div");
    item.className = "target-house-item";

    const details = document.createElement("div");
    details.className = "target-house-details";
    const name = document.createElement("strong");
    name.textContent = house.name;
    const amounts = document.createElement("span");
    amounts.textContent = `總價 ${fmt(house.price)} 萬 · 頭期款 ${fmt(house.downPayment)} 萬`;
    details.append(name, amounts);

    const features = [];
    if (house.area !== undefined && house.area !== null && house.area !== "") {
      features.push(`坪數 ${fmt(house.area)} 坪`);
    }
    if (house.publicRatio !== undefined && house.publicRatio !== null && house.publicRatio !== "") {
      features.push(`公設比 ${fmt(house.publicRatio)}%`);
    }
    if (house.unitPrice !== undefined && house.unitPrice !== null && house.unitPrice !== "") {
      const unitPrice = Number(house.area) > 0 ? house.price / house.area : house.unitPrice;
      features.push(`單價 ${Number(unitPrice).toLocaleString("zh-Hant-TW", { maximumFractionDigits: 2 })} 萬／坪`);
    }
    if (features.length) {
      const featureDetails = document.createElement("span");
      featureDetails.textContent = features.join(" · ");
      details.append(featureDetails);
    }
    if (house.notes) {
      const notes = document.createElement("span");
      notes.className = "target-house-notes-text";
      notes.textContent = `備註：${house.notes}`;
      details.append(notes);
    }

    const actions = document.createElement("div");
    actions.className = "target-house-actions";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.textContent = "帶入";
    loadButton.dataset.action = "load";
    loadButton.dataset.index = index;
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "secondary-button";
    deleteButton.textContent = "刪除";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.index = index;
    actions.append(loadButton, deleteButton);

    item.append(details, actions);
    list.append(item);
  });
}

function addTargetHouse() {
  const nameInput = document.getElementById("targetHouseName");
  const name = nameInput.value.trim();
  if (!name) {
    document.getElementById("targetHouseStatus").textContent = "請先輸入目標房屋名稱。";
    nameInput.focus();
    return;
  }

  const houses = loadTargetHouses();
  houses.push({
    name,
    price: parseFloat(document.getElementById("housePrice").value) || 0,
    downPayment: parseFloat(document.getElementById("downPayment").value) || 0,
    area: optionalTargetHouseNumber("targetHouseArea"),
    publicRatio: optionalTargetHouseNumber("targetHousePublicRatio"),
    unitPrice: optionalTargetHouseNumber("targetHouseUnitPrice"),
    notes: document.getElementById("targetHouseNotes").value.trim(),
  });
  if (!saveTargetHouses(houses)) return;

  nameInput.value = "";
  ["targetHouseArea", "targetHousePublicRatio", "targetHouseUnitPrice", "targetHouseNotes"].forEach((id) => {
    document.getElementById(id).value = "";
  });
  document.getElementById("targetHouseStatus").textContent = "目標房屋已加入清單。";
  renderTargetHouses();
}

function optionalTargetHouseNumber(id) {
  const value = document.getElementById(id).value;
  return value === "" ? null : Number(value);
}

function handleTargetHouseAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const houses = loadTargetHouses();
  const index = Number(button.dataset.index);
  const house = houses[index];
  if (!house) return;

  if (button.dataset.action === "load") {
    document.getElementById("housePrice").value = house.price;
    document.getElementById("downPayment").value = house.downPayment;
    document.getElementById("targetHouseName").value = house.name;
    document.getElementById("targetHouseArea").value = house.area ?? "";
    document.getElementById("targetHousePublicRatio").value = house.publicRatio ?? "";
    document.getElementById("targetHouseNotes").value = house.notes ?? "";
    updateTargetHouseUnitPrice();
    updateLoanResult();
    saveRememberedInputs();
    document.getElementById("targetHouseStatus").textContent = `已帶入「${house.name}」。`;
    return;
  }

  houses.splice(index, 1);
  if (!saveTargetHouses(houses)) return;
  document.getElementById("targetHouseStatus").textContent = "目標房屋已從清單移除。";
  renderTargetHouses();
}

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

function renderLoanResult(schedule, loanAmount, dtiRatioPct) {
  const totalPayment = schedule.reduce((s, r) => s + r.payment, 0);
  const totalInterest = totalPayment - loanAmount;
  const firstMonthPayment = schedule[0].payment;
  const dtiRatio = dtiRatioPct > 0 ? dtiRatioPct / 100 : 0.33;
  const requiredAnnualSalary = (firstMonthPayment * 12) / dtiRatio;

  const el = document.getElementById("loanResult");
  el.innerHTML = `
    <div class="stat"><div class="label">首月月付金（萬元）</div><div class="value">${fmt(firstMonthPayment)}</div></div>
    <div class="stat"><div class="label">總繳金額（萬元）</div><div class="value">${fmt(totalPayment)}</div></div>
    <div class="stat"><div class="label">總利息（萬元）</div><div class="value">${fmt(totalInterest)}</div></div>
    <div class="stat"><div class="label">需求年薪估算（萬元）</div><div class="value">${fmt(requiredAnnualSalary)}</div></div>
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
      maintainAspectRatio: false,
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

function updateTargetHouseUnitPrice() {
  const price = Number.parseFloat(document.getElementById("housePrice").value);
  const area = Number.parseFloat(document.getElementById("targetHouseArea").value);
  const unitPrice = document.getElementById("targetHouseUnitPrice");
  unitPrice.value = Number.isFinite(price) && Number.isFinite(area) && area > 0
    ? (price / area).toFixed(2)
    : "";
}

function updateLoanResult() {
  const loanAmount = updateLoanAmount();
  const loanRate = parseFloat(document.getElementById("loanRate").value) || 0;
  const loanYears = parseInt(document.getElementById("loanYears").value) || 1;
  const repayType = document.getElementById("repayType").value;
  const dtiRatio = parseFloat(document.getElementById("dtiRatio").value) || 33;

  const loanSchedule = calcLoanSchedule(loanAmount, loanRate, loanYears, repayType);
  renderLoanResult(loanSchedule, loanAmount, dtiRatio);
  return loanSchedule;
}

function runCalculation() {
  const loanSchedule = updateLoanResult();

  const currentCash = parseFloat(document.getElementById("currentCash").value) || 0;
  const currentStock = parseFloat(document.getElementById("currentStock").value) || 0;

  const monthlyCash = parseFloat(document.getElementById("monthlyCash").value) || 0;
  const cashGrowthRate = parseFloat(document.getElementById("cashGrowthRate").value) || 0;
  const monthlyStock = parseFloat(document.getElementById("monthlyStock").value) || 0;
  const stockGrowthRate = parseFloat(document.getElementById("stockGrowthRate").value) || 0;
  const simYears = parseInt(document.getElementById("simYears").value) || 1;

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

if (loadRememberedInputs()) {
  document.getElementById("memoryStatus").textContent = "已載入上次儲存的設定。";
}

updateTargetHouseUnitPrice();
document.getElementById("calcBtn").addEventListener("click", runCalculation);
document.getElementById("saveTargetHouseBtn").addEventListener("click", addTargetHouse);
document.getElementById("targetHouseList").addEventListener("click", handleTargetHouseAction);
renderTargetHouses();
document.getElementById("housePrice").addEventListener("input", updateTargetHouseUnitPrice);
document.getElementById("targetHouseArea").addEventListener("input", updateTargetHouseUnitPrice);
[...rememberedFieldIds].forEach((id) => {
  document.getElementById(id).addEventListener("input", saveRememberedInputs);
  document.getElementById(id).addEventListener("change", saveRememberedInputs);
});
document.getElementById("clearMemoryBtn").addEventListener("click", clearRememberedInputs);
["housePrice", "downPayment", "loanRate", "loanYears", "dtiRatio"].forEach((id) =>
  document.getElementById(id).addEventListener("input", updateLoanResult)
);
document.getElementById("repayType").addEventListener("change", updateLoanResult);
document.addEventListener("DOMContentLoaded", runCalculation);
