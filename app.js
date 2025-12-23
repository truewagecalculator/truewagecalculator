const $ = (id) => document.getElementById(id);

const state = {
  payMode: "salary" // salary | hourly
};

function toNum(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(n) {
  if (!Number.isFinite(n)) return "$—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtNum(n, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function setPayMode(mode) {
  state.payMode = mode;
  const salaryRow = document.querySelector("[data-salary-row]");
  const hourlyRow = document.querySelector("[data-hourly-row]");
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach(t => {
    const active = t.dataset.pay === mode;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  salaryRow.classList.toggle("hidden", mode !== "salary");
  hourlyRow.classList.toggle("hidden", mode !== "hourly");
}

function getWorkingWeeks(ptoWeeks) {
  const weeks = 52 - ptoWeeks;
  return Math.max(0, Math.min(52, weeks));
}

function calculate() {
  const scheduledHoursWk = toNum($("scheduledHours").value) || 0;
  const unpaidOTWk = toNum($("unpaidOvertime").value) || 0;
  const unpaidBreakMins = toNum($("unpaidBreakMins").value) || 0;
  const commuteMinsOneWay = toNum($("commuteMinsOneWay").value) || 0;
  const commuteDaysWk = toNum($("daysPerWeek").value) || 0;
  const ptoWeeks = toNum($("ptoWeeks").value) || 0;

  const prepMinsDaily = toNum($("prepMinsDaily").value) || 0;
  const annualBonus = toNum($("annualBonus").value) || 0;
  const benefitsValue = toNum($("benefitsValue").value) || 0;
  const stressTaxPct = toNum($("stressTax").value) || 0;

  // Basic validation (soft)
  const workingWeeks = getWorkingWeeks(ptoWeeks);
  const workingDaysPerYear = Math.max(0, commuteDaysWk) * workingWeeks;

  // Pay
  let basePay = 0;
  if (state.payMode === "salary") {
    basePay = toNum($("annualSalary").value);
  } else {
    const hourlyRate = toNum($("hourlyRate").value);
    // Paid hours are scheduled hours only (common assumption)
    basePay = hourlyRate * scheduledHoursWk * workingWeeks;
  }
  const annualPayCounted = Math.max(0, basePay + annualBonus + benefitsValue);

  // Hours
  const scheduledHoursYear = Math.max(0, scheduledHoursWk) * workingWeeks;
  const overtimeHoursYear = Math.max(0, unpaidOTWk) * workingWeeks;

  const breakHoursYear = (Math.max(0, unpaidBreakMins) / 60) * workingDaysPerYear;

  // Commute: round trip each day
  const commuteHoursYear = ((Math.max(0, commuteMinsOneWay) * 2) / 60) * workingDaysPerYear;

  const prepHoursYear = (Math.max(0, prepMinsDaily) / 60) * workingDaysPerYear;

  const totalHoursYear = scheduledHoursYear + overtimeHoursYear + breakHoursYear + commuteHoursYear + prepHoursYear;

  if (annualPayCounted <= 0 || totalHoursYear <= 0) {
    renderEmpty("Please enter your pay and time details.");
    return;
  }

  let trueHourly = annualPayCounted / totalHoursYear;
  const stressFactor = Math.max(0, Math.min(20, stressTaxPct)) / 100;
  const trueHourlyAfterStress = trueHourly * (1 - stressFactor);

  // Comparison: nominal hourly (paid-only)
  const nominalHourly = annualPayCounted / Math.max(1, scheduledHoursYear);

  render({
    trueHourly,
    trueHourlyAfterStress,
    stressTaxPct,
    nominalHourly,
    annualPayCounted,
    workingWeeks,
    scheduledHoursYear,
    overtimeHoursYear,
    commuteHoursYear,
    breakHoursYear,
    prepHoursYear,
    totalHoursYear
  });
}

function renderEmpty(msg) {
  $("trueHourly").textContent = "$—";
  $("compareText").textContent = msg;

  $("annualPay").textContent = "$—";
  $("workingWeeks").textContent = "—";
  $("scheduledHoursYear").textContent = "—";
  $("overtimeHoursYear").textContent = "—";
  $("commuteHoursYear").textContent = "—";
  $("breakHoursYear").textContent = "—";
  $("prepHoursYear").textContent = "—";
  $("totalHoursYear").textContent = "—";
}

function render(r) {
  const showStress = r.stressTaxPct > 0;
  const shownHourly = showStress ? r.trueHourlyAfterStress : r.trueHourly;

  $("trueHourly").textContent = fmtMoney(shownHourly);

  const delta = shownHourly - r.nominalHourly;
  const sign = delta >= 0 ? "+" : "−";
  const absDelta = Math.abs(delta);

  const stressNote = showStress ? ` (after ${r.stressTaxPct}% stress factor)` : "";
  $("compareText").textContent =
    `Nominal hourly ≈ ${fmtMoney(r.nominalHourly)}. True wage${stressNote} is ${sign}${fmtMoney(absDelta)} per hour.`;

  $("annualPay").textContent = fmtMoney(r.annualPayCounted);
  $("workingWeeks").textContent = fmtNum(r.workingWeeks, 1);
  $("scheduledHoursYear").textContent = fmtNum(r.scheduledHoursYear, 1);
  $("overtimeHoursYear").textContent = fmtNum(r.overtimeHoursYear, 1);
  $("commuteHoursYear").textContent = fmtNum(r.commuteHoursYear, 1);
  $("breakHoursYear").textContent = fmtNum(r.breakHoursYear, 1);
  $("prepHoursYear").textContent = fmtNum(r.prepHoursYear, 1);
  $("totalHoursYear").textContent = fmtNum(r.totalHoursYear, 1);
}

function resetAll() {
  const ids = [
    "annualSalary","hourlyRate","scheduledHours","unpaidOvertime","unpaidBreakMins",
    "commuteMinsOneWay","daysPerWeek","ptoWeeks","prepMinsDaily","annualBonus","benefitsValue"
  ];
  ids.forEach(id => { if ($(id)) $(id).value = ""; });

  $("stressTax").value = "0";
  $("stressTaxLabel").textContent = "0%";
  $("copyStatus").textContent = "";

  setPayMode("salary");
  renderEmpty("Enter details and calculate.");
}

async function copySummary() {
  const trueHourly = $("trueHourly").textContent;
  const annualPay = $("annualPay").textContent;
  const totalHours = $("totalHoursYear").textContent;

  if (!trueHourly || trueHourly === "$—") {
    $("copyStatus").textContent = "Calculate first.";
    return;
  }

  const text = `True Wage Calculator (truewagecalculator.com)
True hourly wage: ${trueHourly}
Annual pay counted: ${annualPay}
Total time cost (hrs/year): ${totalHours}
Breakdown includes commute + unpaid overtime + unpaid breaks + prep (if entered).`;

  try {
    await navigator.clipboard.writeText(text);
    $("copyStatus").textContent = "Copied.";
  } catch {
    $("copyStatus").textContent = "Copy failed (browser blocked).";
  }
}

function init() {
  // Footer year
  $("year").textContent = String(new Date().getFullYear());

  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => setPayMode(btn.dataset.pay));
  });

  // Stress label
  $("stressTax").addEventListener("input", (e) => {
    $("stressTaxLabel").textContent = `${e.target.value}%`;
  });

  $("calcBtn").addEventListener("click", calculate);
  $("resetBtn").addEventListener("click", resetAll);
  $("copyBtn").addEventListener("click", copySummary);

  // Defaults (reasonable)
  $("scheduledHours").value = "40";
  $("unpaidOvertime").value = "0";
  $("unpaidBreakMins").value = "30";
  $("commuteMinsOneWay").value = "0";
  $("daysPerWeek").value = "5";
  $("ptoWeeks").value = "3";

  setPayMode("salary");
  renderEmpty("Enter details and calculate.");
}

init();
