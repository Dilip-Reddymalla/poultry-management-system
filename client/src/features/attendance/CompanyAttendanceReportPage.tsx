import { useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../auth/use-auth.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { useResource } from "../../hooks/useResource.js";
import {
  fetchAttendanceReport,
  fetchCompanies,
  fetchFarms,
} from "../../api/resources.js";
import type {
  EnterpriseAttendanceReportResponse,
  Shift,
} from "../../api/types.js";
import { SHIFTS } from "../../api/types.js";
import { todayInputValue } from "../../lib/display.js";
import { setLastSelectedFarmId } from "../../lib/farm-selection.js";
import { EmptyState, ErrorState, Panel } from "../../components/ui.js";
import { SHIFT_CONFIG } from "./attendance-dashboard-types.js";
import "./AttendanceReport.css";

// ── Palette of vibrant distinct colors for cross-farm visualization ───
const FARM_COLOR_PALETTE = [
  { bar: "linear-gradient(135deg, #10b981 0%, #059669 100%)", solid: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "#10b981", text: "#065f46" },
  { bar: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", solid: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", border: "#3b82f6", text: "#1e40af" },
  { bar: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)", solid: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", border: "#8b5cf6", text: "#5b21b6" },
  { bar: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)", solid: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "#f59e0b", text: "#92400e" },
  { bar: "linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)", solid: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", border: "#06b6d4", text: "#155e75" },
  { bar: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)", solid: "#ec4899", bg: "rgba(236, 72, 153, 0.12)", border: "#ec4899", text: "#9d174d" },
  { bar: "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)", solid: "#14b8a6", bg: "rgba(20, 184, 166, 0.12)", border: "#14b8a6", text: "#115e59" },
  { bar: "linear-gradient(135deg, #f97316 0%, #c2410c 100%)", solid: "#f97316", bg: "rgba(249, 115, 22, 0.12)", border: "#f97316", text: "#9a3412" },
  { bar: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", solid: "#6366f1", bg: "rgba(99, 102, 241, 0.12)", border: "#6366f1", text: "#3730a3" },
  { bar: "linear-gradient(135deg, #84cc16 0%, #4d7c0f 100%)", solid: "#84cc16", bg: "rgba(132, 204, 22, 0.12)", border: "#84cc16", text: "#3f6212" },
];

function getTrendTierColor(rate: number, isSelected: boolean) {
  if (isSelected) {
    return {
      bar: "linear-gradient(180deg, var(--moss) 0%, #2e5339 100%)",
      color: "var(--moss)",
    };
  }
  if (rate >= 90) {
    return {
      bar: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
      color: "#10b981",
    };
  }
  if (rate >= 75) {
    return {
      bar: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
      color: "#3b82f6",
    };
  }
  if (rate >= 60) {
    return {
      bar: "linear-gradient(180deg, #f59e0b 0%, #d97706 100%)",
      color: "#f59e0b",
    };
  }
  return {
    bar: "linear-gradient(180deg, #f43f5e 0%, #e11d48 100%)",
    color: "#f43f5e",
  };
}

function getFarmPalette(idx: number) {
  const p = FARM_COLOR_PALETTE[idx % FARM_COLOR_PALETTE.length];
  if (p) return p;
  return {
    bar: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    solid: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "#10b981",
    text: "#065f46",
  };
}

export function AttendanceReportPage(): React.ReactElement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSystemAdmin = Boolean(
    user?.isSystemAdmin ||
    user?.scope?.level === "GLOBAL" ||
    user?.role === "System Administrator" ||
    user?.role === "SYSTEM_ADMIN" ||
    (user?.roles && user.roles.includes("System Administrator")),
  );

  const [params, setParams] = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set(key, value);
          } else {
            next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const selectedDate = params.get("date") || todayInputValue();
  const setDate = useCallback(
    (v: string) => setParam("date", v === todayInputValue() ? "" : v),
    [setParam],
  );

  const selectedCompanyId = params.get("companyId") || "";
  const setSelectedCompanyId = useCallback(
    (v: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v) {
            next.set("companyId", v);
          } else {
            next.delete("companyId");
          }
          next.delete("farmId");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const selectedFarmId = params.get("farmId") || "";
  const setSelectedFarmId = useCallback(
    (v: string) => setParam("farmId", v),
    [setParam],
  );

  const selectedShift = (params.get("shift") || "") as Shift | "";
  const setSelectedShift = useCallback(
    (v: Shift | "") => setParam("shift", v),
    [setParam],
  );

  // Quick Date presets
  const setQuickDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setDate(d.toISOString().slice(0, 10));
  };

  const isToday = selectedDate === todayInputValue();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = selectedDate === yesterday.toISOString().slice(0, 10);

  const [comparisonGraphMode, setComparisonGraphMode] = useState<"rate" | "delta" | "workforce">("rate");

  // Expanded farm cards state (for shift breakdown accordion)
  const [expandedFarms, setExpandedFarms] = useState<Record<string, boolean>>({});
  const toggleFarmExpanded = (farmId: string) => {
    setExpandedFarms((prev) => ({ ...prev, [farmId]: !prev[farmId] }));
  };

  // Companies dropdown (only relevant for System Admin)
  const companiesRes = useResource(
    "report-companies",
    (signal) => fetchCompanies(signal),
    { enabled: isSystemAdmin },
  );

  // Farms dropdown for filtering
  const farmsRes = useResource(
    `report-farms-${selectedCompanyId}`,
    (signal) => fetchFarms(selectedCompanyId ? { companyId: selectedCompanyId } : {}, signal),
  );

  // Main Report Query
  const reportKey = `attendance-report-${selectedDate}-${selectedCompanyId}-${selectedFarmId}-${selectedShift}`;
  const reportRes = useResource<EnterpriseAttendanceReportResponse>(
    reportKey,
    (signal) =>
      fetchAttendanceReport(
        {
          date: selectedDate,
          ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
          ...(selectedFarmId ? { farmId: selectedFarmId } : {}),
          ...(selectedShift ? { shift: selectedShift } : {}),
        },
        signal,
      ),
  );

  const report: EnterpriseAttendanceReportResponse | null = reportRes.data;

  return (
    <div className="att-report-page">
      <PageHeader
        title={t("nav.attendanceReport", "Attendance Report")}
        description={
          isSystemAdmin
            ? "Enterprise cross-company workforce presence, historical compliance, and farm operations overview."
            : "Consolidated attendance status, 7-day trend analysis, and performance across all farms under your company."
        }
      />

      {/* ── Filter Panel ─────────────────────────────────────────────────── */}
      <div className="att-report__filter-panel">
        {/* Quick Date Pills */}
        <div className="att-report__quick-dates">
          <button
            type="button"
            className={`att-report__pill-btn ${isToday ? "att-report__pill-btn--active" : ""}`}
            onClick={() => setQuickDate(0)}
          >
            Today
          </button>
          <button
            type="button"
            className={`att-report__pill-btn ${isYesterday ? "att-report__pill-btn--active" : ""}`}
            onClick={() => setQuickDate(1)}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={`att-report__pill-btn ${!isToday && !isYesterday ? "att-report__pill-btn--active" : ""}`}
            onClick={() => {}}
          >
            {selectedDate}
          </button>
        </div>

        {/* Form Controls Grid with styled dropdowns */}
        <div className="att-report__controls-grid">
          {/* Date Picker */}
          <div className="field">
            <label className="field__label">Report Date</label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Company Picker (System Admin Only) */}
          {isSystemAdmin && (
            <div className="field">
              <label className="field__label">Company Scope</label>
              <select
                className="input att-report__select"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
              >
                <option value="">All Companies</option>
                {companiesRes.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Farm Picker */}
          <div className="field">
            <label className="field__label">Target Farm</label>
            <select
              className="input att-report__select"
              value={selectedFarmId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedFarmId(val);
                if (val) {
                  setLastSelectedFarmId(val);
                }
              }}
            >
              <option value="">All Farms</option>
              {farmsRes.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} - {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Shift Picker */}
          <div className="field">
            <label className="field__label">Shift Window</label>
            <select
              className="input att-report__select"
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value as Shift | "")}
            >
              <option value="">All Shifts</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {SHIFT_CONFIG[s].label} Shift
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {reportRes.loading && (
        <Panel>
          <div style={{ padding: "2.5rem", textAlign: "center" }}>
            <span className="eyebrow">Aggregating attendance metrics across farms...</span>
          </div>
        </Panel>
      )}

      {reportRes.error && (
        <ErrorState
          error={reportRes.error}
          onRetry={reportRes.reload}
        />
      )}

      {report && !reportRes.loading && (
        <>
          {/* ── Executive KPIs Grid ─────────────────────────────────────────── */}
          <div className="att-report__kpi-overview">
            <div className="att-report__kpi-card att-report__kpi-card--rate">
              <p className="kpi__label eyebrow">Overall Attendance Rate</p>
              <p className="att-report__kpi-rate-large numeric">
                {report.overview.overallAttendanceRate}%
              </p>
              <p className="kpi__detail">
                {report.overview.totalPresent} of {report.overview.totalWorkforce} Workforce Present
              </p>
            </div>

            <div className="att-report__kpi-card att-report__kpi-card--present">
              <p className="kpi__label eyebrow">Present Workforce</p>
              <p className="kpi__value numeric">{report.overview.totalPresent}</p>
              <p className="kpi__detail">Active on site across sheds</p>
            </div>

            <div className="att-report__kpi-card att-report__kpi-card--absent">
              <p className="kpi__label eyebrow">Absent / Leave</p>
              <p className="kpi__value numeric">
                {report.overview.totalAbsent + report.overview.totalLeave}
              </p>
              <p className="kpi__detail">
                {report.overview.totalAbsent} absent · {report.overview.totalLeave} on leave
              </p>
            </div>

            <div className="att-report__kpi-card att-report__kpi-card--unmarked">
              <p className="kpi__label eyebrow">Unmarked</p>
              <p className="kpi__value numeric">{report.overview.totalUnmarked}</p>
              <p className="kpi__detail">Pending shift punch-in</p>
            </div>

            {report.overview.totalPendingApprovals > 0 && (
              <div className="att-report__kpi-card att-report__kpi-card--pending">
                <p className="kpi__label eyebrow" style={{ color: "var(--clay)" }}>
                  Pending Approval
                </p>
                <p className="kpi__value numeric" style={{ color: "var(--clay)" }}>
                  {report.overview.totalPendingApprovals}
                </p>
                <p className="kpi__detail">Requires manager sign-off</p>
              </div>
            )}
          </div>

          {/* ── 7-Day Trend Analysis ───────────────────────────────────────── */}
          {report.trends && report.trends.length > 0 && (
            <div className="att-report__trend-panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <h3 style={{ fontSize: "var(--step-0)", fontWeight: 600 }}>
                    7-Day Attendance Trend Analysis
                  </h3>
                  <p className="kpi__detail" style={{ fontSize: "var(--step--1)" }}>
                    Daily company-wide workforce turnout leading up to {selectedDate}. Tap any day to inspect.
                  </p>
                </div>
              </div>

              <div className="att-report__trend-bars-wrapper">
                <div className="att-report__trend-bars">
                  {report.trends.map((trend) => {
                    const isSelected = trend.date === selectedDate;
                    const barHeightPct = Math.max(10, trend.attendanceRate);
                    const tier = getTrendTierColor(trend.attendanceRate, isSelected);

                    return (
                      <div
                        key={trend.date}
                        className={`att-report__trend-column ${isSelected ? "att-report__trend-column--selected" : ""}`}
                        onClick={() => setDate(trend.date)}
                        title={`${trend.date}: ${trend.attendanceRate}% (${trend.present} Present)`}
                      >
                        <span className="att-report__trend-badge">Active</span>
                        <span
                          className="att-report__trend-rate numeric"
                          style={{ color: isSelected ? "var(--moss)" : tier.color }}
                        >
                          {trend.attendanceRate}%
                        </span>
                        <div className="att-report__trend-bar-track">
                          <div
                            className={`att-report__trend-bar-fill ${isSelected ? "att-report__trend-bar-fill--selected" : ""}`}
                            style={{ height: `${barHeightPct}%`, background: tier.bar }}
                          />
                        </div>
                        <span className="att-report__trend-day">
                          {trend.dayLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Cross-Farm Attendance Comparison & Difference Graph ─────────── */}
          {report.farmComparison && report.farmComparison.length >= 2 && (() => {
            const farms = report.farmComparison;
            const topFarm = farms[0];
            const lowestFarm = farms[farms.length - 1];
            if (!topFarm || !lowestFarm) return null;

            const spreadGap = Math.round((topFarm.attendanceRate - lowestFarm.attendanceRate) * 10) / 10;
            const avgRate = report.overview.overallAttendanceRate;
            const aboveAvgCount = farms.filter((f) => f.attendanceRate >= avgRate).length;
            const maxRate = Math.max(...farms.map((f) => f.attendanceRate), 100);

            return (
              <div className="att-report__comparison-panel">
                <div className="att-report__comparison-header">
                  <div>
                    <h3 className="att-report__section-title">
                      Cross-Farm Attendance Comparison & Difference
                    </h3>
                    <p className="kpi__detail" style={{ fontSize: "var(--step--1)" }}>
                      Comparative analysis across {farms.length} farms with distinct color mapping, delta variance, and benchmark indicators.
                    </p>
                  </div>
                  <span className="att-report__comparison-count eyebrow">
                    {farms.length} Farms Analyzed
                  </span>
                </div>

                {/* KPI Summary Strip for Farm Differences */}
                <div className="att-report__diff-kpi-strip">
                  <div className="att-report__diff-kpi-card">
                    <span className="att-report__diff-kpi-label">Performance Gap</span>
                    <span className="att-report__diff-kpi-value numeric" style={{ color: spreadGap > 20 ? "var(--rust)" : "var(--ink)" }}>
                      {spreadGap}%
                    </span>
                    <span className="att-report__diff-kpi-sub">
                      Between top and lowest farm
                    </span>
                  </div>

                  <div className="att-report__diff-kpi-card">
                    <span className="att-report__diff-kpi-label">Top Performer</span>
                    <span className="att-report__diff-kpi-value numeric" style={{ color: "#10b981" }}>
                      {topFarm.attendanceRate}%
                    </span>
                    <span className="att-report__diff-kpi-sub" title={topFarm.farmName}>
                      {topFarm.farmCode} • {topFarm.farmName}
                    </span>
                  </div>

                  <div className="att-report__diff-kpi-card">
                    <span className="att-report__diff-kpi-label">Lowest Performer</span>
                    <span className="att-report__diff-kpi-value numeric" style={{ color: "#f43f5e" }}>
                      {lowestFarm.attendanceRate}%
                    </span>
                    <span className="att-report__diff-kpi-sub" title={lowestFarm.farmName}>
                      {lowestFarm.farmCode} • {lowestFarm.farmName} (-{spreadGap}%)
                    </span>
                  </div>

                  <div className="att-report__diff-kpi-card">
                    <span className="att-report__diff-kpi-label">Company Avg Benchmark</span>
                    <span className="att-report__diff-kpi-value numeric">
                      {avgRate}%
                    </span>
                    <span className="att-report__diff-kpi-sub">
                      {aboveAvgCount} of {farms.length} farms above avg
                    </span>
                  </div>
                </div>

                {/* ── Visual Multi-Color Comparative Graphs ─────────────────────── */}
                <div className="att-report__chart-container">
                  <div className="att-report__chart-title-row">
                    <div>
                      <h4 className="att-report__chart-title">
                        {comparisonGraphMode === "rate" && "Cross-Farm Turnout Rate Comparison"}
                        {comparisonGraphMode === "delta" && "Attendance Deviation from Company Average (±%)"}
                        {comparisonGraphMode === "workforce" && "Staff Volume & Turnout Breakdown by Farm"}
                      </h4>
                      <p className="kpi__detail" style={{ fontSize: "0.72rem" }}>
                        {comparisonGraphMode === "rate" && `Comparing all ${farms.length} farms against Company Average benchmark (${avgRate}%).`}
                        {comparisonGraphMode === "delta" && `Visualizing performance variance above and below the ${avgRate}% average baseline.`}
                        {comparisonGraphMode === "workforce" && `Workforce turnout volume: Present headcount vs total registered workers.`}
                      </p>
                    </div>

                    {/* Graph Mode Switcher Tabs */}
                    <div className="att-report__graph-tabs">
                      <button
                        type="button"
                        className={`att-report__graph-tab-btn ${comparisonGraphMode === "rate" ? "att-report__graph-tab-btn--active" : ""}`}
                        onClick={() => setComparisonGraphMode("rate")}
                      >
                        📊 Turnout %
                      </button>
                      <button
                        type="button"
                        className={`att-report__graph-tab-btn ${comparisonGraphMode === "delta" ? "att-report__graph-tab-btn--active" : ""}`}
                        onClick={() => setComparisonGraphMode("delta")}
                      >
                        📉 Variance (±%)
                      </button>
                      <button
                        type="button"
                        className={`att-report__graph-tab-btn ${comparisonGraphMode === "workforce" ? "att-report__graph-tab-btn--active" : ""}`}
                        onClick={() => setComparisonGraphMode("workforce")}
                      >
                        👥 Workforce
                      </button>
                    </div>
                  </div>

                  {/* ── MODE 1: Attendance Rate Comparison ── */}
                  {comparisonGraphMode === "rate" && (
                    <div className="att-report__chart-stage">
                      {/* Y-Axis scale marks */}
                      <div className="att-report__chart-y-axis">
                        <span>100%</span>
                        <span>75%</span>
                        <span>50%</span>
                        <span>25%</span>
                        <span>0%</span>
                      </div>

                      {/* Grid lines */}
                      <div className="att-report__chart-grid">
                        <div className="att-report__chart-grid-line" style={{ bottom: "100%" }} />
                        <div className="att-report__chart-grid-line" style={{ bottom: "75%" }} />
                        <div className="att-report__chart-grid-line" style={{ bottom: "50%" }} />
                        <div className="att-report__chart-grid-line" style={{ bottom: "25%" }} />
                      </div>

                      {/* Benchmark Average Line across the graph */}
                      <div
                        className="att-report__chart-benchmark-line"
                        style={{ bottom: `${Math.min(96, Math.max(4, avgRate))}%` }}
                        title={`Company Average: ${avgRate}%`}
                      >
                        <span className="att-report__chart-benchmark-tag">Avg {avgRate}%</span>
                      </div>

                      {/* Side-by-side multi-color bars */}
                      <div className="att-report__chart-bars">
                        {farms.map((fc, idx) => {
                          const palette = getFarmPalette(idx);
                          const barHeight = Math.max(6, Math.min(100, fc.attendanceRate));
                          const isAboveAvg = fc.deltaFromAvg >= 0;

                          return (
                            <div
                              key={fc.farmId}
                              className="att-report__chart-bar-col"
                              title={`${fc.farmName} (${fc.farmCode}): ${fc.attendanceRate}% turnout (${fc.presentCount}/${fc.totalWorkforce} present). Delta vs avg: ${fc.deltaFromAvg >= 0 ? "+" : ""}${fc.deltaFromAvg}%`}
                            >
                              <span className="att-report__chart-rate-label numeric">
                                {fc.attendanceRate}%
                              </span>
                              <span
                                className={`att-report__chart-delta-badge numeric ${isAboveAvg ? "att-report__chart-delta-badge--up" : "att-report__chart-delta-badge--down"}`}
                              >
                                {fc.deltaFromAvg >= 0 ? "+" : ""}{fc.deltaFromAvg}%
                              </span>

                              <div className="att-report__chart-bar-track">
                                <div
                                  className="att-report__chart-bar-fill"
                                  style={{
                                    height: `${barHeight}%`,
                                    background: palette.bar,
                                    boxShadow: `0 3px 10px ${palette.bg}`,
                                  }}
                                />
                              </div>

                              <Link
                                to={`/attendance/dashboard?farmId=${encodeURIComponent(fc.farmId)}&date=${encodeURIComponent(selectedDate)}`}
                                className="att-report__chart-farm-tag"
                                style={{
                                  color: palette.solid,
                                  borderColor: palette.border,
                                  backgroundColor: palette.bg,
                                }}
                                title={`Go to ${fc.farmName} Dashboard`}
                              >
                                {fc.farmCode}
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── MODE 2: Variance / Difference Divergence Graph ── */}
                  {comparisonGraphMode === "delta" && (() => {
                    const maxAbsDelta = Math.max(5, ...farms.map((f) => Math.abs(f.deltaFromAvg)));

                    return (
                      <div className="att-report__chart-stage att-report__chart-stage--diverging">
                        {/* Center Zero Line (Average benchmark) */}
                        <div className="att-report__chart-zero-line">
                          <span className="att-report__chart-zero-tag">Company Avg Baseline (0% diff)</span>
                        </div>

                        {/* Top (+max) and Bottom (-max) guideline labels */}
                        <div className="att-report__chart-y-axis">
                          <span>+{maxAbsDelta}%</span>
                          <span style={{ color: "var(--moss)", fontWeight: 700 }}>Avg</span>
                          <span>-{maxAbsDelta}%</span>
                        </div>

                        <div className="att-report__chart-diverging-bars">
                          {farms.map((fc, idx) => {
                            const palette = getFarmPalette(idx);
                            const isPositive = fc.deltaFromAvg >= 0;
                            const barHeightPct = Math.max(5, (Math.abs(fc.deltaFromAvg) / maxAbsDelta) * 44);

                            return (
                              <div
                                key={fc.farmId}
                                className="att-report__chart-diverge-col"
                                title={`${fc.farmName}: ${fc.deltaFromAvg >= 0 ? "+" : ""}${fc.deltaFromAvg}% difference from company average (${avgRate}%)`}
                              >
                                {isPositive && (
                                  <span className="att-report__diverge-val att-report__diverge-val--pos numeric">
                                    +{fc.deltaFromAvg}%
                                  </span>
                                )}

                                <div className="att-report__diverge-slot">
                                  {isPositive ? (
                                    <div
                                      className="att-report__diverge-bar att-report__diverge-bar--up"
                                      style={{
                                        height: `${barHeightPct}%`,
                                        background: palette.bar,
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="att-report__diverge-bar att-report__diverge-bar--down"
                                      style={{
                                        height: `${barHeightPct}%`,
                                        background: "linear-gradient(180deg, #f43f5e 0%, #be123c 100%)",
                                      }}
                                    />
                                  )}
                                </div>

                                {!isPositive && (
                                  <span className="att-report__diverge-val att-report__diverge-val--neg numeric">
                                    {fc.deltaFromAvg}%
                                  </span>
                                )}

                                <Link
                                  to={`/attendance/dashboard?farmId=${encodeURIComponent(fc.farmId)}&date=${encodeURIComponent(selectedDate)}`}
                                  className="att-report__chart-farm-tag"
                                  style={{
                                    color: palette.solid,
                                    borderColor: palette.border,
                                    backgroundColor: palette.bg,
                                  }}
                                >
                                  {fc.farmCode}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── MODE 3: Workforce Turnout Volumes (Stacked Bar) ── */}
                  {comparisonGraphMode === "workforce" && (() => {
                    const maxWf = Math.max(1, ...farms.map((f) => f.totalWorkforce));

                    return (
                      <div className="att-report__chart-stage">
                        <div className="att-report__chart-y-axis">
                          <span>{maxWf}</span>
                          <span>{Math.round(maxWf * 0.75)}</span>
                          <span>{Math.round(maxWf * 0.5)}</span>
                          <span>{Math.round(maxWf * 0.25)}</span>
                          <span>0</span>
                        </div>

                        <div className="att-report__chart-grid">
                          <div className="att-report__chart-grid-line" style={{ bottom: "100%" }} />
                          <div className="att-report__chart-grid-line" style={{ bottom: "75%" }} />
                          <div className="att-report__chart-grid-line" style={{ bottom: "50%" }} />
                          <div className="att-report__chart-grid-line" style={{ bottom: "25%" }} />
                        </div>

                        <div className="att-report__chart-bars">
                          {farms.map((fc, idx) => {
                            const palette = getFarmPalette(idx);
                            const totalH = Math.max(8, (fc.totalWorkforce / maxWf) * 100);
                            const presentRatio = fc.totalWorkforce > 0 ? fc.presentCount / fc.totalWorkforce : 0;
                            const absentRatio = 1 - presentRatio;

                            return (
                              <div
                                key={fc.farmId}
                                className="att-report__chart-bar-col"
                                title={`${fc.farmName}: ${fc.presentCount} present, ${fc.absentCount} absent out of ${fc.totalWorkforce} staff`}
                              >
                                <span className="att-report__chart-rate-label numeric">
                                  {fc.presentCount}/{fc.totalWorkforce}
                                </span>

                                <div className="att-report__chart-bar-track">
                                  <div
                                    className="att-report__stacked-bar-container"
                                    style={{ height: `${totalH}%` }}
                                  >
                                    <div
                                      className="att-report__stacked-segment att-report__stacked-segment--absent"
                                      style={{ height: `${absentRatio * 100}%` }}
                                      title={`Absent: ${fc.absentCount}`}
                                    />
                                    <div
                                      className="att-report__stacked-segment"
                                      style={{
                                        height: `${presentRatio * 100}%`,
                                        background: palette.bar,
                                      }}
                                      title={`Present: ${fc.presentCount}`}
                                    />
                                  </div>
                                </div>

                                <Link
                                  to={`/attendance/dashboard?farmId=${encodeURIComponent(fc.farmId)}&date=${encodeURIComponent(selectedDate)}`}
                                  className="att-report__chart-farm-tag"
                                  style={{
                                    color: palette.solid,
                                    borderColor: palette.border,
                                    backgroundColor: palette.bg,
                                  }}
                                >
                                  {fc.farmCode}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Ranked Breakdown List with Color Badges & Delta Details ────── */}
                <div className="att-report__comparison-list">
                  {farms.map((fc, idx) => {
                    const palette = getFarmPalette(idx);
                    const barWidthPct = maxRate > 0 ? Math.max(5, (fc.attendanceRate / maxRate) * 100) : 5;
                    const deltaPositive = fc.deltaFromAvg >= 0;
                    const deltaFromTop = Math.round((topFarm.attendanceRate - fc.attendanceRate) * 10) / 10;
                    const avgMarkerPos = maxRate > 0 ? Math.min(100, Math.max(0, (avgRate / maxRate) * 100)) : 0;

                    return (
                      <div
                        key={fc.farmId}
                        className={`att-report__comparison-row ${fc.isBest ? "att-report__comparison-row--best" : ""} ${fc.isWorst ? "att-report__comparison-row--worst" : ""}`}
                      >
                        {/* Rank Badge with Farm's Unique Color */}
                        <div className="att-report__comparison-rank">
                          <span
                            className="att-report__rank-badge"
                            style={{
                              backgroundColor: palette.bg,
                              color: palette.solid,
                              borderColor: palette.border,
                            }}
                          >
                            #{fc.rank}
                          </span>
                        </div>

                        {/* Farm Info + Colored Bar */}
                        <div className="att-report__comparison-main">
                          <div className="att-report__comparison-info">
                            <div className="att-report__comparison-farm-row">
                              <span
                                className="att-report__farm-badge"
                                style={{
                                  borderColor: palette.border,
                                  color: palette.solid,
                                  backgroundColor: palette.bg,
                                  fontWeight: 600,
                                }}
                              >
                                {fc.farmCode}
                              </span>
                              <Link
                                to={`/attendance/dashboard?farmId=${encodeURIComponent(fc.farmId)}&date=${encodeURIComponent(selectedDate)}`}
                                className="att-report__comparison-farm-name"
                              >
                                {fc.farmName}
                              </Link>
                              {fc.isBest && (
                                <span className="att-report__crown-badge">★ Top</span>
                              )}
                              {fc.isWorst && (
                                <span className="att-report__trail-badge">▼ Lowest</span>
                              )}
                            </div>
                            <span className="att-report__comparison-meta">
                              {fc.presentCount}/{fc.totalWorkforce} present • {fc.totalWorkforce} staff
                            </span>
                          </div>

                          {/* Horizontal bar with Unique Color & Benchmark Marker */}
                          <div className="att-report__comparison-bar-track">
                            <div
                              className="att-report__comparison-bar-fill"
                              style={{
                                width: `${barWidthPct}%`,
                                background: palette.bar,
                              }}
                            />
                            {/* Average Benchmark Marker */}
                            <div
                              className="att-report__comparison-avg-marker"
                              style={{ left: `${avgMarkerPos}%` }}
                              title={`Avg Benchmark: ${avgRate}%`}
                            />
                          </div>
                        </div>

                        {/* Rate + Delta Column */}
                        <div className="att-report__comparison-stats">
                          <span className="att-report__comparison-rate numeric">
                            {fc.attendanceRate}%
                          </span>
                          <span
                            className={`att-report__comparison-delta numeric ${deltaPositive ? "att-report__comparison-delta--up" : "att-report__comparison-delta--down"}`}
                          >
                            {deltaPositive ? "▲ +" : "▼ "}{fc.deltaFromAvg}% vs avg
                          </span>
                          {idx > 0 && (
                            <span className="att-report__comparison-delta-top numeric">
                              -{deltaFromTop}% vs #1
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Difference Summary Narrative */}
                <div className="att-report__comparison-legend">
                  <span className="att-report__comparison-legend-dot" />
                  <span className="kpi__detail">
                    {farms.length === 2 ? (
                      <>
                        <strong>{topFarm.farmName}</strong> leads <strong>{lowestFarm.farmName}</strong> by <strong>{spreadGap}%</strong> turnout ({topFarm.presentCount} present vs {lowestFarm.presentCount} present).
                      </>
                    ) : (
                      <>
                        Spread: <strong>{spreadGap}%</strong> gap between leader <strong>{topFarm.farmName}</strong> ({topFarm.attendanceRate}%) and <strong>{lowestFarm.farmName}</strong> ({lowestFarm.attendanceRate}%). {aboveAvgCount} of {farms.length} farms exceed the company average ({avgRate}%).
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* ── Farm-by-Farm Performance Cards ──────────────────────────────── */}
          <div>
            <div style={{ marginBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--step-1)", fontWeight: 600 }}>
                Farm Performance Breakdown ({report.farms.length})
              </h3>
              <p className="kpi__detail">
                Click any farm name to navigate directly to its detailed operational dashboard.
              </p>
            </div>

            {report.farms.length === 0 ? (
              <Panel>
                <EmptyState
                  title="No Farms Found"
                  description="No active farms found matching the selected filter criteria."
                />
              </Panel>
            ) : (
              <div className="att-report__farm-list">
                {report.farms.map((farm) => {
                  const isExpanded = Boolean(expandedFarms[farm.farmId]);
                  // Detailed dashboard URL with farm pre-selected
                  const farmDashboardUrl = `/attendance/dashboard?farmId=${encodeURIComponent(farm.farmId)}&date=${encodeURIComponent(selectedDate)}`;

                  return (
                    <div key={farm.farmId} className="att-report__farm-card">
                      {/* Farm Header */}
                      <div className="att-report__farm-top">
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                            <span className="att-report__farm-badge">{farm.farmCode}</span>
                            <Link
                              to={farmDashboardUrl}
                              className="att-report__farm-link"
                              onClick={() => setLastSelectedFarmId(farm.farmId)}
                              title={`Open detailed attendance dashboard for ${farm.farmName}`}
                            >
                              {farm.farmName} ↗
                            </Link>
                          </div>
                          {isSystemAdmin && (
                            <p className="kpi__detail" style={{ marginTop: "2px" }}>
                              Company: <strong>{farm.companyName}</strong>
                            </p>
                          )}
                        </div>

                        {/* Rate Tag */}
                        <div style={{ textAlign: "right" }}>
                          <span
                            className="numeric"
                            style={{
                              fontSize: "var(--step-2)",
                              fontWeight: 700,
                              lineHeight: 1,
                              color: farm.attendanceRate >= 80 ? "var(--moss)" : "var(--rust)",
                            }}
                          >
                            {farm.attendanceRate}%
                          </span>
                          <p className="eyebrow" style={{ marginTop: "2px" }}>Rate</p>
                        </div>
                      </div>

                      {/* Headcount Breakdown Grid */}
                      <div className="att-report__headcount-row">
                        <div className="att-report__hc-item">
                          <span className="eyebrow">Workforce</span>
                          <span className="att-report__hc-num numeric">{farm.totalWorkforce}</span>
                        </div>
                        <div className="att-report__hc-item">
                          <span className="eyebrow" style={{ color: "var(--moss)" }}>Present</span>
                          <span className="att-report__hc-num numeric" style={{ color: "var(--moss)" }}>
                            {farm.presentCount}
                          </span>
                        </div>
                        <div className="att-report__hc-item">
                          <span className="eyebrow" style={{ color: "var(--rust)" }}>Absent</span>
                          <span className="att-report__hc-num numeric" style={{ color: "var(--rust)" }}>
                            {farm.absentCount}
                          </span>
                        </div>
                        <div className="att-report__hc-item">
                          <span className="eyebrow" style={{ color: "var(--clay)" }}>Leave/Half</span>
                          <span className="att-report__hc-num numeric" style={{ color: "var(--clay)" }}>
                            {farm.halfDayCount + farm.leaveCount}
                          </span>
                        </div>
                      </div>

                      {/* Shifts Breakdown Accordion & Detailed Dashboard Action */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "var(--space-2)", borderTop: "1px solid var(--line)" }}>
                        <button
                          type="button"
                          className="linkbutton"
                          onClick={() => toggleFarmExpanded(farm.farmId)}
                        >
                          {isExpanded ? "▾ Hide Shift Details" : "▸ View Shift Details"}
                        </button>

                        <Link to={farmDashboardUrl} className="att-report__drill-link">
                          Open Farm Dashboard →
                        </Link>
                      </div>

                      {isExpanded && (
                        <div className="att-report__shift-strip">
                          {SHIFTS.map((shiftKey) => {
                            const sData = farm.shiftsBreakdown[shiftKey];
                            const cfg = SHIFT_CONFIG[shiftKey];
                            return (
                              <div key={shiftKey} className="att-report__shift-pill">
                                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontWeight: 600 }}>
                                  <span>{cfg.icon}</span>
                                  <span>{cfg.label}</span>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-soft)", fontSize: "var(--step--1)" }}>
                                  <span>P: <strong style={{ color: "var(--moss)" }}>{sData.present}</strong></span>
                                  <span>A: <strong style={{ color: "var(--rust)" }}>{sData.absent}</strong></span>
                                  <span>H: {sData.halfDay}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
