/**
 * TrueWageCalculator - app.js
 * Includes:
 * - Salary vs Hourly mode
 * - Role preset single-select buttons (Custom/Hourly/Supervisor/Manager/Director)
 * - Presets prefill fields EVEN if defaults exist, but NEVER overwrite user-edited fields
 * - Work strain adjustment (optional) with clear label
 * - “What this means” insights block
 * - Copy summary
 * - Shopify-style side drawer nav (accessible; inert + focus management)
 */

/* ===============================
   Utilities (scoped)
   =============================== */
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    payMode: "salary",     // "salary" | "hourly"
    rolePreset: "custom",  // "custom" | "hourly" | "supervisor" | "manager" | "director"
  };

  function toNum(v) {
    if (v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }
  function fmtMoney(n) {
    if (!Number.isFinite(n)) return "$—";
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  function fmtNum(n, digits = 1) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  }
  function fmtHours(n) {
    if (!Number.isFinite(n)) return "—";
    return `${fmtNum(n, 1)} hrs`;
  }

  const ROLE_PRESETS = {
    custom: null,
    hourly: {
      unpaidOvertime: 0,
      unpaidBreakMins: 30,
      prepMinsDaily: 10,
      stressTax: 0,
    },
    supervisor: {
      unpaidOvertime: 3,
      unpaidBreakMins: 20,
      prepMinsDaily: 15,
      stressTax: 3,
    },
    manager: {
      unpaidOvertime: 7,
      unpaidBreakMins: 10,
      prepMinsDaily: 20,
      stressTax: 6,
    },
    director: {
      unpaidOvertime: 12,
      unpaidBreakMins: 0,
      prepMinsDaily: 30,
      stressTax: 10,
    },
  };

  function getWorkingWeeks(ptoWeeks) {
    return clamp(52 - ptoWeeks, 0, 52);
  }

  if (document.getElementById("year")) {
  document.getElementById("year").textContent = new Date().getFullYear();
}


  /* ===============================
     Calculator: touched tracking
     =============================== */
  function wireTouchedTracking() {
    const ids = [
      "unpaidOvertime",
      "unpaidBreakMins",
      "prepMinsDaily",
      "commuteMinsOneWay",
      "daysPerWeek",
      "ptoWeeks",
      "scheduledHours",
      "annualSalary",
      "hourlyRate",
      "annualBonus",
      "benefitsValue",
    ];

    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", () => {
        el.dataset.touched = "1";
      });
    });

    const stressEl = $("stressTax");
    if (stressEl) {
      stressEl.addEventListener("input", (e) => {
        const el = e.target;
        el.dataset.touched = "1";
        const lbl = $("stressTaxLabel");
        if (lbl) lbl.textContent = `${el.value}%`;
      });
    }
  }

  function applyRolePreset(presetKey) {
    const preset = ROLE_PRESETS[presetKey];
    if (!preset) return;

    const setIfAllowed = (id, value) => {
      const el = $(id);
      if (!el) return;

      if (el.dataset.touched === "1") return;

      const current = String(el.value || "").trim();
      const fromPreset = el.dataset.fromPreset === "1";

      if (current === "" || fromPreset) {
        el.value = String(value);
        el.dataset.fromPreset = "1";
      }
    };

    setIfAllowed("unpaidOvertime", preset.unpaidOvertime);
    setIfAllowed("unpaidBreakMins", preset.unpaidBreakMins);
    setIfAllowed("prepMinsDaily", preset.prepMinsDaily);

    const stressEl = $("stressTax");
    if (stressEl && stressEl.dataset.touched !== "1") {
      const fromPreset = stressEl.dataset.fromPreset === "1";
      const current = String(stressEl.value || "0");
      if (current === "0" || fromPreset) {
        stressEl.value = String(preset.stressTax);
        stressEl.dataset.fromPreset = "1";
        const lbl = $("stressTaxLabel");
        if (lbl) lbl.textContent = `${stressEl.value}%`;
      }
    }
  }

  function setRolePreset(role) {
    state.rolePreset = role;

    document.querySelectorAll(".role-tab").forEach((btn) => {
      const active = btn.dataset.role === role;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    if (role !== "custom") applyRolePreset(role);
  }

  function setPayMode(mode) {
    state.payMode = mode;

    document.querySelectorAll(".tab").forEach((t) => {
      const active = t.dataset.pay === mode;
      t.classList.toggle("active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });

    const salaryRow = document.querySelector("[data-salary-row]");
    const hourlyRow = document.querySelector("[data-hourly-row]");
    if (salaryRow) salaryRow.classList.toggle("hidden", mode !== "salary");
    if (hourlyRow) hourlyRow.classList.toggle("hidden", mode !== "hourly");
  }

  function renderEmpty(msg) {
    // Only run if the calculator result area exists on this page
    const th = $("trueHourly");
    const ct = $("compareText");
    if (!th || !ct) return;

    th.textContent = "$—";
    ct.textContent = msg;

    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };

    set("annualPay", "$—");
    set("workingWeeks", "—");
    set("scheduledHoursYear", "—");
    set("overtimeHoursYear", "—");
    set("commuteHoursYear", "—");
    set("breakHoursYear", "—");
    set("prepHoursYear", "—");
    set("totalHoursYear", "—");

    set("insCommute", "—");
    set("insCommuteSub", "—");
    set("insUnpaid", "—");
    set("insUnpaidSub", "—");
    set("insDrop", "—");
    set("insDropSub", "—");
  }

  function calculate() {
    // Defensive: ensure calculator fields exist
    if (!$("scheduledHours") || !$("daysPerWeek") || !$("ptoWeeks")) {
      return;
    }

    // Time inputs
    const scheduledHoursWk = toNum($("scheduledHours").value) || 0;
    const unpaidOTWk = toNum($("unpaidOvertime")?.value) || 0;
    const unpaidBreakMins = toNum($("unpaidBreakMins")?.value) || 0;
    const commuteMinsOneWay = toNum($("commuteMinsOneWay")?.value) || 0;
    const commuteDaysWk = toNum($("daysPerWeek").value) || 0;
    const ptoWeeks = toNum($("ptoWeeks").value) || 0;
    const prepMinsDaily = toNum($("prepMinsDaily")?.value) || 0;

    // Pay inputs
    const annualBonus = toNum($("annualBonus")?.value) || 0;
    const benefitsValue = toNum($("benefitsValue")?.value) || 0;

    // Work strain
    const stressTaxPct = clamp(toNum($("stressTax")?.value) || 0, 0, 20);

    const workingWeeks = getWorkingWeeks(ptoWeeks);
    const workingDaysPerYear = Math.max(0, commuteDaysWk) * workingWeeks;

    // Annual pay
    let basePay = 0;
    if (state.payMode === "salary") {
      basePay = toNum($("annualSalary")?.value);
    } else {
      const hourlyRate = toNum($("hourlyRate")?.value);
      basePay = hourlyRate * scheduledHoursWk * workingWeeks;
    }
    const annualPayCounted = Math.max(0, basePay + annualBonus + benefitsValue);

    // Hours/year
    const scheduledHoursYear = Math.max(0, scheduledHoursWk) * workingWeeks;
    const overtimeHoursYear = Math.max(0, unpaidOTWk) * workingWeeks;
    const breakHoursYear = (Math.max(0, unpaidBreakMins) / 60) * workingDaysPerYear;
    const commuteHoursYear = ((Math.max(0, commuteMinsOneWay) * 2) / 60) * workingDaysPerYear;
    const prepHoursYear = (Math.max(0, prepMinsDaily) / 60) * workingDaysPerYear;

    const totalHoursYear =
      scheduledHoursYear + overtimeHoursYear + breakHoursYear + commuteHoursYear + prepHoursYear;

    if (annualPayCounted <= 0 || totalHoursYear <= 0) {
      renderEmpty("Please enter your pay and time details, then calculate.");
      return;
    }

    // True hourly wage (time-based)
    const trueHourly = annualPayCounted / totalHoursYear;

    // Nominal hourly (only scheduled work hours)
    const nominalHourly = annualPayCounted / Math.max(1, scheduledHoursYear);

    // Work strain adjustment (optional)
    const stressFactor = stressTaxPct / 100;
    const trueHourlyAfterStrain = trueHourly * (1 - stressFactor);

    render({
      annualPayCounted,
      workingWeeks,
      scheduledHoursYear,
      overtimeHoursYear,
      commuteHoursYear,
      breakHoursYear,
      prepHoursYear,
      totalHoursYear,
      nominalHourly,
      trueHourly,
      stressTaxPct,
      trueHourlyAfterStrain,
    });
  }

  function render(r) {
    const th = $("trueHourly");
    const ct = $("compareText");
    if (!th || !ct) return;

    const showStrain = r.stressTaxPct > 0;
    const displayed = showStrain ? r.trueHourlyAfterStrain : r.trueHourly;

    th.textContent = fmtMoney(displayed);

    const delta = displayed - r.nominalHourly;
    const sign = delta >= 0 ? "+" : "−";
    const absDelta = Math.abs(delta);

    const strainNote = showStrain
      ? ` (after ${r.stressTaxPct}% work strain adjustment)`
      : "";

    ct.textContent =
      `Nominal hourly ≈ ${fmtMoney(r.nominalHourly)}. ` +
      `True wage${strainNote} is ${sign}${fmtMoney(absDelta)} per hour.`;

    const set = (id, v) => {
      const el = $(id);
      if (el) el.textContent = v;
    };

    set("annualPay", fmtMoney(r.annualPayCounted));
    set("workingWeeks", fmtNum(r.workingWeeks, 1));
    set("scheduledHoursYear", fmtNum(r.scheduledHoursYear, 1));
    set("overtimeHoursYear", fmtNum(r.overtimeHoursYear, 1));
    set("commuteHoursYear", fmtNum(r.commuteHoursYear, 1));
    set("breakHoursYear", fmtNum(r.breakHoursYear, 1));
    set("prepHoursYear", fmtNum(r.prepHoursYear, 1));
    set("totalHoursYear", fmtNum(r.totalHoursYear, 1));

    // Insights
    const commuteHours = r.commuteHoursYear;
    const unpaidHours = r.overtimeHoursYear + r.breakHoursYear + r.prepHoursYear;

    const commuteWeeks = commuteHours / 40;
    const unpaidWeeks = unpaidHours / 40;

    const commuteTimeValue = r.nominalHourly * commuteHours;
    const unpaidTimeValue = r.nominalHourly * unpaidHours;

    const dropPct = clamp((1 - r.trueHourly / r.nominalHourly) * 100, 0, 99.9);

    if ($("insCommute")) {
      $("insCommute").textContent = fmtHours(commuteHours);
      $("insCommuteSub").textContent =
        `${fmtNum(commuteWeeks, 1)} workweeks (~${fmtMoney(commuteTimeValue)} of time at nominal rate)`;
    }

    if ($("insUnpaid")) {
      $("insUnpaid").textContent = fmtHours(unpaidHours);
      $("insUnpaidSub").textContent =
        `${fmtNum(unpaidWeeks, 1)} workweeks (~${fmtMoney(unpaidTimeValue)} of time at nominal rate)`;
    }

    if ($("insDrop")) {
      $("insDrop").textContent = `${fmtNum(dropPct, 1)}% lower`;
      const strainExtra =
        r.stressTaxPct > 0
          ? ` With strain adjustment, the displayed true wage is further reduced by ${r.stressTaxPct}%.`
          : ` Add a work strain adjustment if you want a subjective quality-of-life reduction.`;
      $("insDropSub").textContent =
        `Your true wage (time-based) is ~${fmtNum(dropPct, 1)}% below nominal.${strainExtra}`;
    }
  }

  async function copySummary() {
    const trueHourly = $("trueHourly")?.textContent;
    const status = $("copyStatus");

    if (!trueHourly || trueHourly === "$—") {
      if (status) status.textContent = "Calculate first.";
      return;
    }

    const annualPay = $("annualPay")?.textContent || "";
    const totalHours = $("totalHoursYear")?.textContent || "";

    const commute = $("insCommute")?.textContent || "";
    const unpaid = $("insUnpaid")?.textContent || "";
    const drop = $("insDrop")?.textContent || "";

    const role = state.rolePreset || "custom";
    const mode = state.payMode;

    const text =
`True Wage Calculator (truewagecalculator.com)
Mode: ${mode}
Role preset: ${role}
True hourly wage: ${trueHourly}
Annual pay counted: ${annualPay}
Total time cost (hrs/year): ${totalHours}
Commute (hrs/year): ${commute}
Unpaid time (hrs/year): ${unpaid}
Effective drop vs nominal: ${drop}
Includes commute + unpaid overtime + unpaid breaks + prep (if entered).`;

    try {
      await navigator.clipboard.writeText(text);
      if (status) status.textContent = "Copied.";
    } catch {
      if (status) status.textContent = "Copy failed (browser blocked).";
    }
  }

  function clearTouchedAndPresetFlags() {
    document.querySelectorAll("input").forEach((el) => {
      delete el.dataset.touched;
      delete el.dataset.fromPreset;
    });

    const stressEl = $("stressTax");
    if (stressEl) {
      delete stressEl.dataset.touched;
      delete stressEl.dataset.fromPreset;
    }
  }

  function resetAll() {
    const ids = [
      "annualSalary",
      "hourlyRate",
      "scheduledHours",
      "unpaidOvertime",
      "unpaidBreakMins",
      "commuteMinsOneWay",
      "daysPerWeek",
      "ptoWeeks",
      "prepMinsDaily",
      "annualBonus",
      "benefitsValue",
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });

    if ($("stressTax")) $("stressTax").value = "0";
    if ($("stressTaxLabel")) $("stressTaxLabel").textContent = "0%";

    clearTouchedAndPresetFlags();

    setPayMode("salary");
    setRolePreset("custom");

    if ($("scheduledHours")) $("scheduledHours").value = "40";
    if ($("unpaidOvertime")) $("unpaidOvertime").value = "0";
    if ($("unpaidBreakMins")) $("unpaidBreakMins").value = "30";
    if ($("commuteMinsOneWay")) $("commuteMinsOneWay").value = "0";
    if ($("daysPerWeek")) $("daysPerWeek").value = "5";
    if ($("ptoWeeks")) $("ptoWeeks").value = "3";

    ["unpaidOvertime", "unpaidBreakMins", "prepMinsDaily"].forEach((id) => {
      const el = $(id);
      if (el) el.dataset.fromPreset = "1";
    });
    if ($("stressTax")) $("stressTax").dataset.fromPreset = "1";

    if ($("copyStatus")) $("copyStatus").textContent = "";
    renderEmpty("Enter details and calculate.");
  }

  function initCalculatorIfPresent() {
    if ($("year")) $("year").textContent = String(new Date().getFullYear());

    const isCalculatorPage = !!$("calcBtn") || !!$("trueHourly");
    if (!isCalculatorPage) return;

    document.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => setPayMode(btn.dataset.pay));
    });

    document.querySelectorAll(".role-tab").forEach((btn) => {
      btn.addEventListener("click", () => setRolePreset(btn.dataset.role));
    });

    $("calcBtn")?.addEventListener("click", calculate);
    $("resetBtn")?.addEventListener("click", resetAll);
    $("copyBtn")?.addEventListener("click", copySummary);

    wireTouchedTracking();

    setPayMode("salary");
    setRolePreset("custom");

    if ($("scheduledHours")) $("scheduledHours").value = "40";
    if ($("unpaidOvertime")) $("unpaidOvertime").value = "0";
    if ($("unpaidBreakMins")) $("unpaidBreakMins").value = "30";
    if ($("commuteMinsOneWay")) $("commuteMinsOneWay").value = "0";
    if ($("daysPerWeek")) $("daysPerWeek").value = "5";
    if ($("ptoWeeks")) $("ptoWeeks").value = "3";
    if ($("stressTax")) $("stressTax").value = "0";
    if ($("stressTaxLabel")) $("stressTaxLabel").textContent = "0%";

    ["unpaidOvertime", "unpaidBreakMins", "prepMinsDaily"].forEach((id) => {
      const el = $(id);
      if (el) el.dataset.fromPreset = "1";
    });
    if ($("stressTax")) $("stressTax").dataset.fromPreset = "1";

    renderEmpty("Enter details and calculate.");
  }

  initCalculatorIfPresent();

// ===============================
// Mobile Dropdown Menu
// ===============================
    (function setupMobileDropdown(){
      const header = document.querySelector(".site-header");
      const btn = document.querySelector(".nav-toggle");
      const menu = document.getElementById("mobileMenu");

      if (!header || !btn || !menu) return;

      const open = () => {
        header.classList.add("nav-open");
        btn.setAttribute("aria-expanded", "true");
        menu.scrollTop = 0;
      };

      const close = () => {
        header.classList.remove("nav-open");
        btn.setAttribute("aria-expanded", "false");
      };

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        header.classList.contains("nav-open") ? close() : open();
      });

      // Close after clicking a link
      menu.querySelectorAll("a").forEach(a => a.addEventListener("click", close));

      // Close if you click outside
      document.addEventListener("click", (e) => {
        if (!header.contains(e.target)) close();
      });

      // Close on ESC
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
  })();
})();