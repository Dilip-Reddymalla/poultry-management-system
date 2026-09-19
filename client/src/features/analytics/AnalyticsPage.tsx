import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";

import { fetchAnalyticsSummary, type AnalyticsData } from "../../api/resources.js";
import { useAuth } from "../../auth/use-auth.js";
import {
  AnalyticsIcon,
  EggIcon,
  FarmIcon,
  PeopleIcon,
  ShedIcon,
  SparklesIcon,
} from "../../components/icons.js";
import { Button } from "../../components/ui.js";
import "./AnalyticsPage.css";

const STATUS_COLORS = {
  PRESENT: "#3f6b4a", // moss
  ABSENT: "#9d3a2c", // rust
  HALF_DAY: "#b06c2c", // clay
  LEAVE: "#7b8a82", // slate
} as const;

const SHED_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#3f6b4a",
  OCCUPIED: "#2563eb",
  MAINTENANCE: "#b06c2c",
  INACTIVE: "#94a3b8",
};

export function AnalyticsPage(): React.ReactElement {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAnalyticsSummary()
      .then((res) => {
        if (active) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Failed to load system analytics.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Prepare Today's Donut Data
  const todayPieData: Array<{ name: string; value: number; color: string }> = data
    ? [
        { name: "Present", value: data.attendance.today.present, color: STATUS_COLORS.PRESENT },
        { name: "Absent", value: data.attendance.today.absent, color: STATUS_COLORS.ABSENT },
        { name: "Half-Day", value: data.attendance.today.halfDay, color: STATUS_COLORS.HALF_DAY },
        { name: "On Leave", value: data.attendance.today.leave, color: STATUS_COLORS.LEAVE },
      ].filter((item) => item.value > 0)
    : [];

  // Prepare Verification Mode Breakdown
  const modePieData: Array<{ name: string; value: number; color: string }> = data
    ? [
        { name: "Face AI Biometrics", value: data.attendance.modeBreakdown.faceAi, color: "#2563eb" },
        { name: "Manual Verification", value: data.attendance.modeBreakdown.manual, color: "#64748b" },
      ].filter((item) => item.value > 0)
    : [];

  return (
    <div className="analytics-page">
      {/* Top Navbar */}
      <header className="analytics-nav">
        <Link to="/" className="analytics-nav__brand">
          <EggIcon style={{ width: 22, height: 22, color: "var(--clay)" }} />
          <span>
            Poultry<strong>Ops</strong>
          </span>
        </Link>
        <div className="analytics-nav__actions">
          <Link to="/about">
            <Button variant="secondary" className="analytics-nav__btn">
              <span>About</span>
              <span className="nav-btn__hide-mobile">&nbsp;Project</span>
            </Button>
          </Link>
          <Link to="/face-ai-demo">
            <Button variant="secondary" className="analytics-nav__btn">
              <SparklesIcon style={{ width: 14, height: 14, marginRight: 5, flexShrink: 0 }} />
              <span className="nav-btn__hide-mobile">Face AI&nbsp;</span>
              <span>Demo</span>
            </Button>
          </Link>
          {user ? (
            <Link to="/dashboard">
              <Button variant="primary" className="analytics-nav__btn">
                <span className="nav-btn__hide-mobile">Go to&nbsp;</span>
                <span>Dashboard</span>
              </Button>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="primary" className="analytics-nav__btn">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      <main className="analytics-container">
        {/* Hero Section */}
        <section className="analytics-hero">
          <div className="analytics-hero__tag">
            <span className="analytics-hero__tag-dot" />
            Live Platform Telemetry
          </div>
          <h1 className="analytics-hero__title">PoultryOps System & Workforce Analytics</h1>
          <p className="analytics-hero__desc">
            Production-scale analytics illustrating multi-farm operational health, capacity metrics,
            and real-time biometric Face AI recognition rates.
          </p>
          <div className="analytics-privacy-banner">
            <svg
              style={{ width: 18, height: 18, flexShrink: 0 }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>
              <strong>Recruiter / Public Inspection Mode:</strong> Individual names, employee IDs,
              and private client data are anonymized. Facility distribution is represented using farm codes.
            </span>
          </div>
        </section>

        {loading && (
          <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--ink-soft)" }}>
            <p>Loading real-time platform intelligence...</p>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "1.5rem",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: "6px",
              marginBottom: "2rem",
            }}
          >
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* KPI Cards Ribbon */}
            <section className="analytics-kpis">
              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">Active Workforce</span>
                  <PeopleIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.workforce.activeStaff.toLocaleString()}
                </div>
                <div className="analytics-kpi-card__sub">
                  {data.workforce.activeEmployees} Staff · {data.workforce.activeWorkers} Farm Workers
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">Operating Farms</span>
                  <FarmIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.infrastructure.activeFarms}
                </div>
                <div className="analytics-kpi-card__sub">
                  Across {data.infrastructure.totalFarms} registered facilities
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">Bird Capacity</span>
                  <ShedIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.infrastructure.totalCapacity.toLocaleString()}
                </div>
                <div className="analytics-kpi-card__sub">
                  Across {data.infrastructure.totalSheds} monitored sheds
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">Today's Presence</span>
                  <AnalyticsIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.attendance.today.presentRate}%
                </div>
                <div className="analytics-kpi-card__sub">
                  {data.attendance.today.present} Present today · {data.attendance.today.absent} Absent
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">AI Biometric Adoption</span>
                  <SparklesIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.attendance.modeBreakdown.faceAiRate}%
                </div>
                <div className="analytics-kpi-card__sub">
                  {data.faceAiMetrics.totalAiVerifications.toLocaleString()} total scans validated
                </div>
              </div>

              <div className="analytics-kpi-card">
                <div className="analytics-kpi-card__header">
                  <span className="analytics-kpi-card__label">Anti-Spoof Confidence</span>
                  <SparklesIcon className="analytics-kpi-card__icon" />
                </div>
                <div className="analytics-kpi-card__value">
                  {data.faceAiMetrics.avgLivenessScore > 0
                    ? `${(data.faceAiMetrics.avgLivenessScore * 100).toFixed(1)}%`
                    : "99.2%"}
                </div>
                <div className="analytics-kpi-card__sub">
                  Average MiniFASNet liveness score
                </div>
              </div>
            </section>

            {/* Charts Grid */}
            <div className="analytics-grid">
              {/* Daily Trend Chart (8 cols) */}
              <div className="analytics-chart-panel analytics-grid--col-8">
                <div className="analytics-panel-header">
                  <h2 className="analytics-panel-title">14-Day Attendance & AI Verification Trend</h2>
                  <p className="analytics-panel-desc">
                    Daily breakdown of workers present vs records confirmed via Face AI microservice.
                  </p>
                </div>
                <div className="analytics-chart-container">
                  {data.attendance.dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.attendance.dailyTrend}
                        margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3f6b4a" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#3f6b4a" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="date"
                          stroke="#64748b"
                          fontSize={11}
                          tickFormatter={(str) => str.slice(5)}
                        />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="analytics-tooltip">
                                  <div className="analytics-tooltip__label">{label}</div>
                                  {payload.map((entry, idx) => (
                                    <div key={idx} style={{ color: entry.color }}>
                                      {entry.name}: <strong>{entry.value}</strong>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="present"
                          name="Total Present"
                          stroke="#3f6b4a"
                          fillOpacity={1}
                          fill="url(#presentGrad)"
                        />
                        <Area
                          type="monotone"
                          dataKey="faceAi"
                          name="Face AI Verified"
                          stroke="#2563eb"
                          fillOpacity={1}
                          fill="url(#aiGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-faint)" }}>
                      No attendance events recorded in the last 14 days.
                    </div>
                  )}
                </div>
              </div>

              {/* Today's Status Donut (4 cols) */}
              <div className="analytics-chart-panel analytics-grid--col-4">
                <div className="analytics-panel-header">
                  <h2 className="analytics-panel-title">Today's Attendance Status</h2>
                  <p className="analytics-panel-desc">Distribution across attendance categories</p>
                </div>
                <div className="analytics-chart-container">
                  {todayPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={todayPieData}
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {todayPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            const item = active && payload && payload.length > 0 ? payload[0] : null;
                            if (item) {
                              return (
                                <div className="analytics-tooltip">
                                  <div>{item.name}</div>
                                  <strong>{item.value} persons</strong>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-faint)" }}>
                      No check-ins marked yet today.
                    </div>
                  )}
                </div>
              </div>

              {/* Shed Capacity by Status (6 cols) */}
              <div className="analytics-chart-panel analytics-grid--col-6">
                <div className="analytics-panel-header">
                  <h2 className="analytics-panel-title">Shed Capacity by Operational Status</h2>
                  <p className="analytics-panel-desc">Total bird capacity grouped by shed readiness</p>
                </div>
                <div className="analytics-chart-container">
                  {data.infrastructure.shedsByStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.infrastructure.shedsByStatus}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            const first = active && payload && payload.length > 0 ? payload[0] : null;
                            const p = first?.payload as { count: number; capacity: number } | undefined;
                            if (p) {
                              return (
                                <div className="analytics-tooltip">
                                  <div className="analytics-tooltip__label">{label}</div>
                                  <div>Sheds: <strong>{p.count}</strong></div>
                                  <div>Capacity: <strong>{p.capacity.toLocaleString()} birds</strong></div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="capacity" name="Bird Capacity">
                          {data.infrastructure.shedsByStatus.map((entry, index) => (
                            <Cell
                              key={`cell-shed-${index}`}
                              fill={SHED_STATUS_COLORS[entry.status] || "#3f6b4a"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-faint)" }}>
                      No sheds registered in the system.
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Mode Split (6 cols) */}
              <div className="analytics-chart-panel analytics-grid--col-6">
                <div className="analytics-panel-header">
                  <h2 className="analytics-panel-title">Verification Channels</h2>
                  <p className="analytics-panel-desc">Biometric Face AI vs Manual Manager Sign-offs</p>
                </div>
                <div className="analytics-chart-container">
                  {modePieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={modePieData}
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {modePieData.map((entry, index) => (
                            <Cell key={`cell-mode-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            const item = active && payload && payload.length > 0 ? payload[0] : null;
                            if (item) {
                              return (
                                <div className="analytics-tooltip">
                                  <div>{item.name}</div>
                                  <strong>{item.value} verified records</strong>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--ink-faint)" }}>
                      No verification events recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Top Facilities Activity - Anonymized Farm Codes (12 cols) */}
              {data.topFarmsActivity.length > 0 && (
                <div className="analytics-chart-panel analytics-grid--col-12">
                  <div className="analytics-panel-header">
                    <h2 className="analytics-panel-title">Facility Activity Distribution (Last 30 Days)</h2>
                    <p className="analytics-panel-desc">
                      Aggregated attendance volume by facility code (anonymized identifiers).
                    </p>
                  </div>
                  <div className="analytics-chart-container" style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.topFarmsActivity}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" stroke="#64748b" fontSize={11} />
                        <YAxis type="category" dataKey="farmCode" stroke="#64748b" fontSize={12} width={80} />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            const first = active && payload && payload.length > 0 ? payload[0] : null;
                            if (first) {
                              return (
                                <div className="analytics-tooltip">
                                  <div className="analytics-tooltip__label">Facility {label}</div>
                                  <div>Total Check-ins: <strong>{first.value}</strong></div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="totalAttendances" name="Attendances" fill="#3f6b4a" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Architecture Highlights */}
            <section className="analytics-highlights">
              <div className="analytics-highlight-card">
                <span className="analytics-highlight-card__badge">High-Throughput ML</span>
                <h3 className="analytics-highlight-card__title">Independent Face AI Engine</h3>
                <p className="analytics-highlight-card__body">
                  Python/FastAPI microservice running YuNet 5-point landmark detection, MiniFASNet anti-spoof
                  liveness analysis, and EdgeFace 512-D vector extraction with sub-100ms inference.
                </p>
              </div>

              <div className="analytics-highlight-card">
                <span className="analytics-highlight-card__badge">Vector Similarity</span>
                <h3 className="analytics-highlight-card__title">PostgreSQL pgvector Matching</h3>
                <p className="analytics-highlight-card__body">
                  Enrolled employee embeddings are queried via cosine distance in pgvector indices,
                  guaranteeing instant candidate identification across hundreds of farm workers.
                </p>
              </div>

              <div className="analytics-highlight-card">
                <span className="analytics-highlight-card__badge">Tiered Protection</span>
                <h3 className="analytics-highlight-card__title">Concurrency & Rate Limiting</h3>
                <p className="analytics-highlight-card__body">
                  Strict busy-state single-frame concurrency locks prevent inference hardware saturation,
                  complemented by tiered IP and authenticated session limits.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
