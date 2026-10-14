// 房貸與資產成長試算邏輯

const MEMORY_COOKIE = "homeLoanCalculator";
const MEMORY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const rememberedFieldIds = [
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
    const houses = JSON.parse(localStorage.getItem("homeLoanTargetHouses") || "[]");
    return Array.isArray(houses) ? houses : [];
  } catch {
    return [];
  }
}

const VIEWING_STORAGE_KEY = "homeLoanViewingData";
const LEGACY_TARGETS_MIGRATED_KEY = "homeLoanTargetsMigratedToViewingRecords";
const VIEWING_SCHEMA_VERSION = 2;
const DELETED_TAG = "deleted";
const COMPARISON_FIELDS = [
  ["type", "類型"], ["developer", "建設公司"], ["overallRating", "整體評價"], ["location", "位置概述"],
  ["address", "地址"], ["floor", "樓層"], ["titleArea", "權狀坪數"],
  ["publicRatio", "公設比"], ["actualArea", "實際坪數"], ["unitPrice", "單價"],
  ["price", "總價"], ["parkingPrice", "車位價格"], ["parkingDescription", "車位形式／位置"],
  ["parkingSize", "車位尺寸"],
  ["managementFeePerPing", "管理費／坪月"], ["managementFeeMonthly", "管理費／月"],
  ["householdsPerFloor", "一層戶數"], ["elevators", "電梯數"],
  ["downPayment", "頭期款"], ["loanAmount", "貸款金額"], ["loanRate", "貸款年利率"],
  ["loanYears", "貸款年限"], ["repayType", "還款方式"], ["dtiRatio", "房貸負擔比上限"],
  ["monthlyPayment", "首月月付金"], ["totalPayment", "總繳金額"],
  ["totalInterest", "總利息"], ["requiredAnnualSalary", "需求年薪估算"],
];

function createRecordId() {
  return globalThis.crypto?.randomUUID?.() ?? `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentTimestamp() {
  return new Date().toISOString();
}

function localDateTimeValue() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function loadViewingData() {
  try {
    const data = JSON.parse(localStorage.getItem(VIEWING_STORAGE_KEY) || "null");
    const normalized = normalizeViewingData(data);
    if (normalized) {
      if (data.schemaVersion !== VIEWING_SCHEMA_VERSION) {
        localStorage.setItem(VIEWING_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    }
  } catch {
    // Start with an empty data set if stored data is malformed.
  }
  return { schemaVersion: VIEWING_SCHEMA_VERSION, properties: [] };
}

function normalizeViewingData(data) {
  if (!data || !Array.isArray(data.properties)) return null;
  if (data.schemaVersion === VIEWING_SCHEMA_VERSION) {
    return { schemaVersion: VIEWING_SCHEMA_VERSION, properties: data.properties };
  }
  if (data.schemaVersion !== 1 || !Array.isArray(data.visits)) return null;

  const properties = data.properties.map((property) => ({ ...property }));
  properties.forEach((property) => {
    const visits = data.visits
      .filter((visit) => visit.propertyId === property.id && !isDeletedRecord(visit))
      .sort((left, right) => Date.parse(left.visitedAt || left.createdAt) - Date.parse(right.visitedAt || right.createdAt));
    const visitNotes = visits.map((visit) => {
      const note = String(visit.notes || "").trim();
      if (!note) return "";
      return visits.length > 1 && visit.visitedAt
        ? `${formatVisitDate(visit.visitedAt)}：${note}`
        : note;
    }).filter(Boolean);
    const existingNotes = String(property.notes || "").trim();
    property.notes = [...(existingNotes ? [existingNotes] : []), ...visitNotes].join("\n\n");
    const latestVisit = visits.at(-1);
    property.visitedAt = latestVisit?.visitedAt || property.visitedAt || "";
    const timestamps = [property.updatedAt, ...visits.map((visit) => visit.updatedAt)]
      .filter((timestamp) => timestamp && !Number.isNaN(Date.parse(timestamp)));
    if (timestamps.length) property.updatedAt = timestamps.sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  });
  return { schemaVersion: VIEWING_SCHEMA_VERSION, properties };
}

function saveViewingData(data) {
  try {
    localStorage.setItem(VIEWING_STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    setViewingStatus("儲存失敗，請檢查瀏覽器儲存空間。", true);
    return false;
  }
}

function setViewingStatus(message, isError = false) {
  const status = document.getElementById("viewingStatus");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error-status", isError);
}

function isDeletedRecord(record) {
  return Array.isArray(record.tags) && record.tags.includes(DELETED_TAG);
}

function makeRecord(fields) {
  const timestamp = currentTimestamp();
  return { id: createRecordId(), createdAt: timestamp, updatedAt: timestamp, tags: [], ...fields };
}

function migrateLegacyTargetHouses() {
  if (localStorage.getItem(LEGACY_TARGETS_MIGRATED_KEY) === "1") return;
  const legacyHouses = loadTargetHouses();
  if (!legacyHouses.length) {
    localStorage.setItem(LEGACY_TARGETS_MIGRATED_KEY, "1");
    return;
  }

  const data = loadViewingData();
  legacyHouses.forEach((house) => {
    const price = Number(house.price) || 0;
    const titleArea = house.area === null || house.area === undefined ? null : Number(house.area);
    const publicRatio = house.publicRatio === null || house.publicRatio === undefined ? null : Number(house.publicRatio);
    const downPayment = house.downPayment === null || house.downPayment === undefined ? null : Number(house.downPayment);
    const property = makeRecord({
      name: house.name || "未命名物件",
      developer: "",
      type: "",
      status: "待看屋",
      location: "",
      address: "",
      floor: "",
      overallRating: null,
      titleArea,
      publicRatio,
      actualArea: titleArea !== null && publicRatio !== null ? titleArea * (1 - publicRatio / 100) : null,
      price,
      parkingPrice: null,
      unitPrice: titleArea > 0 ? price / titleArea : null,
      parkingDescription: "",
      parkingLengthCm: null,
      parkingWidthCm: null,
      managementFeePerPing: null,
      managementFeeMonthly: null,
      householdsPerFloor: null,
      elevators: null,
      downPayment,
      loanAmount: downPayment === null ? null : Math.max(price - downPayment, 0),
      loanRate: 2.3,
      loanYears: 30,
      repayType: "equalPayment",
      dtiRatio: 33,
      visitedAt: "",
      notes: house.notes || "",
    });
    data.properties.push(property);
  });

  if (saveViewingData(data)) {
    localStorage.setItem(LEGACY_TARGETS_MIGRATED_KEY, "1");
    setViewingStatus(`已將舊版目標清單中的 ${legacyHouses.length} 筆資料轉入物件紀錄。`);
  }
}

function numericField(id) {
  const value = document.getElementById(id).value;
  return value === "" ? null : Number(value);
}

function calculateViewingFields() {
  const titleArea = numericField("viewTitleArea");
  const publicRatio = numericField("viewPublicRatio");
  const price = numericField("viewPrice");
  const actualArea = titleArea !== null && publicRatio !== null
    ? titleArea * (1 - publicRatio / 100)
    : null;
  const unitPrice = titleArea > 0 && price !== null ? price / titleArea : null;
  const feePerPing = numericField("viewManagementFeePerPing");
  const managementFeeMonthly = titleArea !== null && feePerPing !== null
    ? titleArea * feePerPing
    : null;
  document.getElementById("viewActualArea").value = actualArea === null ? "" : actualArea.toFixed(2);
  document.getElementById("viewUnitPrice").value = unitPrice === null ? "" : unitPrice.toFixed(2);
  document.getElementById("viewManagementFeeMonthly").value = managementFeeMonthly === null
    ? ""
    : managementFeeMonthly.toFixed(0);
}

function readPropertyForm() {
  const parkingLength = numericField("viewParkingLength");
  const parkingWidth = numericField("viewParkingWidth");
  return {
    name: document.getElementById("viewName").value.trim(),
    developer: document.getElementById("viewDeveloper").value.trim(),
    type: document.getElementById("viewType").value,
    status: document.getElementById("viewStatus").value,
    location: document.getElementById("viewLocation").value.trim(),
    address: document.getElementById("viewAddress").value.trim(),
    floor: document.getElementById("viewFloor").value.trim(),
    overallRating: numericField("viewRating"),
    titleArea: numericField("viewTitleArea"),
    publicRatio: numericField("viewPublicRatio"),
    actualArea: numericField("viewActualArea"),
    price: numericField("viewPrice"),
    parkingPrice: numericField("viewParkingPrice"),
    unitPrice: numericField("viewUnitPrice"),
    parkingDescription: document.getElementById("viewParkingDescription").value.trim(),
    parkingLengthCm: parkingLength,
    parkingWidthCm: parkingWidth,
    managementFeePerPing: numericField("viewManagementFeePerPing"),
    managementFeeMonthly: numericField("viewManagementFeeMonthly"),
    householdsPerFloor: numericField("viewHouseholdsPerFloor"),
    elevators: numericField("viewElevators"),
    downPayment: numericField("viewDownPayment"),
    loanAmount: numericField("viewLoanAmount"),
    loanRate: numericField("viewLoanRate"),
    loanYears: numericField("viewLoanYears"),
    repayType: document.getElementById("viewRepayType").value,
    dtiRatio: numericField("viewDtiRatio"),
    visitedAt: document.getElementById("viewVisitTime").value,
    notes: document.getElementById("viewNotes").value.trim(),
  };
}

function resetViewingForm() {
  document.getElementById("viewingForm").reset();
  document.getElementById("editingPropertyId").value = "";
  document.getElementById("viewFormTitle").textContent = "新增看房物件";
  document.getElementById("saveViewingBtn").textContent = "新增物件";
  document.getElementById("cancelViewingEditBtn").hidden = true;
  document.getElementById("viewVisitTime").value = localDateTimeValue();
  calculateViewingFields();
  updateLoanResult();
}

function saveViewingProperty(event) {
  event.preventDefault();
  calculateViewingFields();
  updateLoanResult();
  const data = loadViewingData();
  const propertyId = document.getElementById("editingPropertyId").value;
  const timestamp = currentTimestamp();
  const fields = readPropertyForm();
  let preferredSimulationId = propertyId;
  if (!fields.name) {
    setViewingStatus("請輸入建案名稱或房屋名稱。", true);
    return;
  }

  if (propertyId) {
    const property = data.properties.find((item) => item.id === propertyId);
    if (!property) return;
    Object.assign(property, fields, { updatedAt: timestamp });
    setViewingStatus("物件與看屋資料已更新。");
  } else {
    const property = makeRecord(fields);
    data.properties.push(property);
    preferredSimulationId = property.id;
    setViewingStatus("物件與看屋資料已新增。");
  }

  if (!saveViewingData(data)) return;
  resetViewingForm();
  renderViewingProperties(preferredSimulationId);
  runCalculation();
}

function editViewingProperty(propertyId) {
  const data = loadViewingData();
  const property = data.properties.find((item) => item.id === propertyId && !isDeletedRecord(item));
  if (!property) return;
  const loanInputs = loanInputsForProperty(property);

  const fields = {
    viewName: property.name, viewDeveloper: property.developer, viewType: property.type,
    viewStatus: property.status, viewLocation: property.location, viewAddress: property.address,
    viewFloor: property.floor, viewRating: property.overallRating, viewTitleArea: property.titleArea,
    viewPublicRatio: property.publicRatio, viewPrice: property.price, viewParkingPrice: property.parkingPrice,
    viewParkingDescription: property.parkingDescription,
    viewParkingLength: property.parkingLengthCm, viewParkingWidth: property.parkingWidthCm,
    viewManagementFeePerPing: property.managementFeePerPing,
    viewHouseholdsPerFloor: property.householdsPerFloor, viewElevators: property.elevators,
    viewDownPayment: loanInputs.downPayment, viewLoanRate: loanInputs.loanRate,
    viewLoanYears: loanInputs.loanYears, viewRepayType: loanInputs.repayType,
    viewDtiRatio: loanInputs.dtiRatio,
    viewVisitTime: property.visitedAt, viewNotes: property.notes,
  };
  Object.entries(fields).forEach(([id, value]) => {
    document.getElementById(id).value = value ?? "";
  });
  document.getElementById("editingPropertyId").value = property.id;
  document.getElementById("viewFormTitle").textContent = "編輯物件與看屋資料";
  document.getElementById("saveViewingBtn").textContent = "儲存修改";
  document.getElementById("cancelViewingEditBtn").hidden = false;
  calculateViewingFields();
  updateLoanResult();
  document.getElementById("viewingForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

function softDeleteRecord(collection, id) {
  const record = collection.find((item) => item.id === id);
  if (!record || isDeletedRecord(record)) return;
  record.tags = [...new Set([...(record.tags || []), DELETED_TAG])];
  record.updatedAt = currentTimestamp();
}

function softDeleteProperty(propertyId) {
  if (!window.confirm("將此物件標記為刪除？匯出 JSON 後仍可手動復原。")) return;
  const data = loadViewingData();
  softDeleteRecord(data.properties, propertyId);
  if (saveViewingData(data)) {
    setViewingStatus("物件已標記刪除；匯入時仍會保留此標記。");
    renderViewingProperties();
  }
}

function renderViewingProperties(preferredSimulationId = "") {
  const data = loadViewingData();
  const tbody = document.querySelector("#viewingTable tbody");
  const visibleProperties = data.properties.filter((property) => !isDeletedRecord(property));
  tbody.replaceChildren();

  visibleProperties.forEach((property) => {
    const loanMetrics = calculateLoanMetrics(loanInputsForProperty(property));
    const row = document.createElement("tr");
    const compareCell = document.createElement("td");
    const compareCheckbox = document.createElement("input");
    compareCheckbox.type = "checkbox";
    compareCheckbox.className = "compare-checkbox";
    compareCheckbox.value = property.id;
    compareCheckbox.setAttribute("aria-label", `比較：${property.name}`);
    compareCell.append(compareCheckbox);

    const nameCell = document.createElement("td");
    const name = document.createElement("strong");
    name.textContent = property.name || "未命名物件";
    const metadata = document.createElement("span");
    metadata.className = "table-subtitle";
    metadata.textContent = property.location || "未填位置";
    nameCell.append(name, metadata);

    const values = [
      property.status || "待看屋", property.type || "", property.floor || "",
      formatViewingValue(property.price, " 萬"), formatViewingValue(property.unitPrice, " 萬／坪"),
      formatViewingValue(property.actualArea, " 坪"), formatViewingValue(property.managementFeeMonthly, " 元／月"),
      formatViewingValue(loanMetrics.monthlyPayment, " 萬／月"),
      formatViewingValue(loanMetrics.totalInterest, " 萬"),
    ];
    row.append(compareCell, nameCell, ...values.map((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      return cell;
    }));

    const visitDateCell = document.createElement("td");
    visitDateCell.textContent = property.visitedAt ? formatVisitDate(property.visitedAt) : "—";
    const notesCell = document.createElement("td");
    notesCell.className = "viewing-note-cell";
    notesCell.textContent = property.notes || "—";
    row.append(visitDateCell, notesCell);

    const actionsCell = document.createElement("td");
    actionsCell.className = "record-actions";
    actionsCell.append(
      createActionButton("編輯", "edit", property.id),
      createActionButton("刪除", "delete", property.id, true),
    );
    row.append(actionsCell);
    tbody.append(row);
  });
  renderSimulationPropertyOptions(preferredSimulationId);
  renderComparisonTable();
}

function createActionButton(label, action, id, secondary = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  if (secondary) button.className = "secondary-button compact-button";
  return button;
}

function formatViewingValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return "—";
  const formatted = typeof value === "number"
    ? value.toLocaleString("zh-Hant-TW", { maximumFractionDigits: 2 })
    : String(value);
  return `${formatted}${suffix}`;
}

function formatVisitDate(value) {
  if (!value) return "未記錄時間";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-Hant-TW");
}

function renderComparisonTable() {
  const data = loadViewingData();
  const selectedIds = new Set(
    [...document.querySelectorAll(".compare-checkbox:checked")].map((checkbox) => checkbox.value)
  );
  const properties = data.properties.filter((property) => selectedIds.has(property.id) && !isDeletedRecord(property));
  const loanMetrics = new Map(properties.map((property) => [property.id, calculateLoanMetrics(loanInputsForProperty(property))]));
  const table = document.getElementById("comparisonTable");
  table.replaceChildren();
  if (!properties.length) {
    document.getElementById("comparisonEmpty").hidden = false;
    return;
  }
  document.getElementById("comparisonEmpty").hidden = true;

  const thead = document.createElement("thead");
  const titleRow = document.createElement("tr");
  const firstHeader = document.createElement("th");
  firstHeader.textContent = "比較項目";
  titleRow.append(firstHeader);
  properties.forEach((property) => {
    const header = document.createElement("th");
    header.textContent = property.name;
    titleRow.append(header);
  });
  thead.append(titleRow);

  const tbody = document.createElement("tbody");
  [["status", "追蹤狀態"], ...COMPARISON_FIELDS].forEach(([key, label]) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = label;
    row.append(heading);
    properties.forEach((property) => {
      const cell = document.createElement("td");
      const metrics = loanMetrics.get(property.id);
      let value = metrics && key in metrics ? metrics[key] : property[key];
      if (key === "parkingSize") {
        value = property.parkingLengthCm && property.parkingWidthCm
          ? `${property.parkingLengthCm} × ${property.parkingWidthCm} cm`
          : "";
      }
      const suffix = {
        titleArea: " 坪", actualArea: " 坪", unitPrice: " 萬／坪", price: " 萬", parkingPrice: " 萬",
        managementFeePerPing: " 元／坪月", managementFeeMonthly: " 元／月", publicRatio: "%",
        downPayment: " 萬", loanAmount: " 萬", loanRate: "%", loanYears: " 年",
        dtiRatio: "%", monthlyPayment: " 萬／月", totalPayment: " 萬",
        totalInterest: " 萬", requiredAnnualSalary: " 萬／年",
      }[key] || "";
      if (key === "repayType") {
        value = value === "equalPrincipal" ? "本金平均攤還" : "本息平均攤還";
      }
      cell.textContent = key === "overallRating" && value ? `${value}／5` : formatViewingValue(value, suffix);
      row.append(cell);
    });
    tbody.append(row);
  });
  table.append(thead, tbody);
}

function renderSimulationPropertyOptions(preferredId = "") {
  const select = document.getElementById("simulationProperty");
  const selectedId = preferredId || select.value || "form";
  const option = document.createElement("option");
  option.value = "form";
  option.textContent = "目前表單資料";
  select.replaceChildren(option);
  loadViewingData().properties
    .filter((property) => !isDeletedRecord(property))
    .forEach((property) => {
      const propertyOption = document.createElement("option");
      propertyOption.value = property.id;
      propertyOption.textContent = property.name || "未命名物件";
      select.append(propertyOption);
    });
  select.value = [...select.options].some((item) => item.value === selectedId) ? selectedId : "form";
}

function handleViewingTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit") editViewingProperty(id);
  if (action === "delete") softDeleteProperty(id);
}

function mergeRecords(localRecords, importedRecords) {
  const merged = new Map(localRecords.map((record) => [record.id, record]));
  importedRecords.forEach((record) => {
    if (!record || typeof record.id !== "string" || typeof record.updatedAt !== "string" || Number.isNaN(Date.parse(record.updatedAt))) {
      throw new Error("JSON 中有缺少 ID 或有效更新時間的紀錄。");
    }
    const existing = merged.get(record.id);
    if (!existing || Date.parse(record.updatedAt) > Date.parse(existing.updatedAt)) {
      merged.set(record.id, record);
    }
  });
  return [...merged.values()];
}

function exportViewingData() {
  const data = loadViewingData();
  const payload = { ...data, exportedAt: currentTimestamp() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `看房紀錄-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setViewingStatus("JSON 已匯出。請透過私人方式與另一台裝置交換檔案。");
}

async function importViewingData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const normalized = normalizeViewingData(imported);
    if (!normalized) {
      throw new Error("JSON 格式或版本不相容。");
    }
    const local = loadViewingData();
    const merged = {
      schemaVersion: VIEWING_SCHEMA_VERSION,
      properties: mergeRecords(local.properties, normalized.properties),
    };
    if (saveViewingData(merged)) {
      renderViewingProperties();
      setViewingStatus(`匯入完成：物件 ${merged.properties.length} 筆（含刪除標記）。`);
    }
  } catch (error) {
    setViewingStatus(`匯入失敗：${error.message}`, true);
  } finally {
    event.target.value = "";
  }
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

function readLoanInputsFromForm() {
  return {
    price: parseFloat(document.getElementById("viewPrice").value) || 0,
    downPayment: parseFloat(document.getElementById("viewDownPayment").value) || 0,
    loanRate: parseFloat(document.getElementById("viewLoanRate").value) || 0,
    loanYears: parseInt(document.getElementById("viewLoanYears").value) || 30,
    repayType: document.getElementById("viewRepayType").value,
    dtiRatio: parseFloat(document.getElementById("viewDtiRatio").value) || 33,
  };
}

function loanInputsForProperty(property) {
  const price = Number(property.price) || 0;
  return {
    price,
    downPayment: property.downPayment === null || property.downPayment === undefined
      ? price * 0.2
      : Number(property.downPayment),
    loanRate: property.loanRate === null || property.loanRate === undefined ? 2.3 : Number(property.loanRate),
    loanYears: Number(property.loanYears) || 30,
    repayType: property.repayType || "equalPayment",
    dtiRatio: Number(property.dtiRatio) || 33,
  };
}

function calculateLoanMetrics(scenario) {
  const inputs = {
    price: Number(scenario.price) || 0,
    downPayment: Number(scenario.downPayment) || 0,
    loanRate: Number(scenario.loanRate) || 0,
    loanYears: Number(scenario.loanYears) || 30,
    repayType: scenario.repayType || "equalPayment",
    dtiRatio: Number(scenario.dtiRatio) || 33,
  };
  const loanAmount = Math.max(inputs.price - inputs.downPayment, 0);
  const schedule = calcLoanSchedule(loanAmount, inputs.loanRate, inputs.loanYears, inputs.repayType);
  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  const monthlyPayment = schedule[0]?.payment ?? 0;
  return {
    ...inputs,
    loanAmount,
    schedule,
    monthlyPayment,
    totalInterest: totalPayment - loanAmount,
    requiredAnnualSalary: (monthlyPayment * 12) / (inputs.dtiRatio / 100),
  };
}

function updateLoanResult() {
  const loanMetrics = calculateLoanMetrics(readLoanInputsFromForm());
  document.getElementById("viewLoanAmount").value = loanMetrics.loanAmount.toFixed(2);
  renderLoanResult(loanMetrics.schedule, loanMetrics.loanAmount, loanMetrics.dtiRatio);
  return loanMetrics.schedule;
}

function runCalculation() {
  const selectedPropertyId = document.getElementById("simulationProperty").value;
  const selectedProperty = selectedPropertyId === "form"
    ? null
    : loadViewingData().properties.find((property) => property.id === selectedPropertyId && !isDeletedRecord(property));
  const loanInputs = selectedProperty ? loanInputsForProperty(selectedProperty) : readLoanInputsFromForm();
  const loanMetrics = calculateLoanMetrics(loanInputs);
  const loanSchedule = loanMetrics.schedule;

  const currentCash = parseFloat(document.getElementById("currentCash").value) || 0;
  const currentStock = parseFloat(document.getElementById("currentStock").value) || 0;

  const monthlyCash = parseFloat(document.getElementById("monthlyCash").value) || 0;
  const cashGrowthRate = parseFloat(document.getElementById("cashGrowthRate").value) || 0;
  const monthlyStock = parseFloat(document.getElementById("monthlyStock").value) || 0;
  const stockGrowthRate = parseFloat(document.getElementById("stockGrowthRate").value) || 0;
  const simYears = parseInt(document.getElementById("simYears").value) || 1;

  const housePrice = loanMetrics.price;

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

migrateLegacyTargetHouses();
document.getElementById("calcBtn").addEventListener("click", runCalculation);
[...rememberedFieldIds].forEach((id) => {
  document.getElementById(id).addEventListener("input", saveRememberedInputs);
  document.getElementById(id).addEventListener("change", saveRememberedInputs);
});
document.getElementById("clearMemoryBtn").addEventListener("click", clearRememberedInputs);
["viewTitleArea", "viewPublicRatio", "viewPrice", "viewManagementFeePerPing"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    calculateViewingFields();
    updateLoanResult();
  });
});
[
  "viewDownPayment", "viewLoanRate", "viewLoanYears", "viewDtiRatio",
].forEach((id) => document.getElementById(id).addEventListener("input", updateLoanResult));
document.getElementById("viewRepayType").addEventListener("change", updateLoanResult);
document.getElementById("simulationProperty").addEventListener("change", runCalculation);
document.getElementById("viewingForm").addEventListener("submit", saveViewingProperty);
document.getElementById("viewingTable").addEventListener("click", handleViewingTableAction);
document.getElementById("viewingTable").addEventListener("change", (event) => {
  if (event.target.matches(".compare-checkbox")) renderComparisonTable();
});
document.getElementById("cancelViewingEditBtn").addEventListener("click", resetViewingForm);
document.getElementById("exportViewingBtn").addEventListener("click", exportViewingData);
document.getElementById("importViewingBtn").addEventListener("click", () => {
  document.getElementById("importViewingFile").click();
});
document.getElementById("importViewingFile").addEventListener("change", importViewingData);
resetViewingForm();
renderViewingProperties();
document.addEventListener("DOMContentLoaded", runCalculation);
