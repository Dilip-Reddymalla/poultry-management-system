import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fetchEmployeeAttendanceRange } from "../../api/resources.js";
import type { Attendance } from "../../api/types.js";
import { useResource } from "../../hooks/useResource.js";
import { todayInputValue } from "../../lib/display.js";
import { Spinner } from "../../components/ui.js";

/** Return yyyy-mm-dd for N days ago (in local timezone) */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

/** Build an array of yyyy-mm-dd strings for the last 30 calendar days */
function last30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    days.push(daysAgo(i));
  }
  return days;
}

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "#3f6b4a",
  HALF_DAY: "#b06c2c",
  ABSENT: "#9d3a2c",
  LEAVE: "#7b8a82",
};

const SHIFT_COLOR: Record<string, string> = {
  MORNING_SHIFT: "#3f6b4a",
  AFTERNOON_SHIFT: "#b06c2c",
  NIGHT_SHIFT: "#16211c",
  OVERTIME: "#7b8a82",
};

const SHIFT_LABEL: Record<string, string> = {
  MORNING_SHIFT: "Morning",
  AFTERNOON_SHIFT: "Afternoon",
  NIGHT_SHIFT: "Night",
  OVERTIME: "Overtime",
};

interface Props {
  employeeId: string;
}

export function ProfileAttendanceStats({ employeeId }: Props): React.ReactElement {
  const to = todayInputValue();
  const from = daysAgo(29);

  const resource = useResource<{ attendance: Attendance[] }>(
    `profile-attendance:${employeeId}`,
    (signal) => fetchEmployeeAttendanceRange(employeeId, from, to, signal),
  );

  const records = resource.data?.attendance ?? [];

  const stats = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, HALF_DAY: 0, LEAVE: 0 };
    for (const r of records) {
      if (r.status in counts) counts[r.status as keyof typeof counts]++;
    }
    return counts;
  }, [records]);

  const total = stats.PRESENT + stats.ABSENT + stats.HALF_DAY + stats.LEAVE;
  const attendanceRate = total > 0 ? Math.round(((stats.PRESENT + stats.HALF_DAY * 0.5) / total) * 100) : 0;

  // SVG ring dimensions
  const R = 54;
  const CIRC = 2 * Math.PI * R;
  const dash = (attendanceRate / 100) * CIRC;

  // Shift breakdown
  const shiftCounts = useMemo(() => {
    const s: Record<string, number> = {};
    for (const r of records) {
      s[r.shift] = (s[r.shift] ?? 0) + 1;
    }
    return Object.entries(s).map(([shift, count]) => ({
      name: SHIFT_LABEL[shift] ?? shift,
      count,
      fill: SHIFT_COLOR[shift] ?? "#7b8a82",
    }));
  }, [records]);

  // Heatmap: one entry per day
  const days = last30Days();
  const byDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of records) {
      // Take the most "positive" status if multiple records per day
      const existing = map.get(r.date);
      const rank: Record<string, number> = { PRESENT: 3, HALF_DAY: 2, LEAVE: 1, ABSENT: 0 };
      if (!existing || (rank[r.status] ?? -1) > (rank[existing] ?? -1)) {
        map.set(r.date, r.status);
      }
    }
    return map;
  }, [records]);

  // Pie data for the attendance rate donut
  const pieData = [
    { name: "Present", value: stats.PRESENT, fill: STATUS_COLOR.PRESENT },
    { name: "Half Day", value: stats.HALF_DAY, fill: STATUS_COLOR.HALF_DAY },
    { name: "Absent", value: stats.ABSENT, fill: STATUS_COLOR.ABSENT },
    { name: "Leave", value: stats.LEAVE, fill: STATUS_COLOR.LEAVE },
  ].filter((d) => d.value > 0);

  if (resource.loading) {
    return (
      <div className="ph-loading">
        <Spinner label="Loading attendance data" />
      </div>
    );
  }

  return (
    <div className="ph-stats">
      {/* Stat counter cards */}
      <div className="ph-stat-grid">
        {(
          [
            { key: "PRESENT", label: "Present", icon: "✓" },
            { key: "ABSENT", label: "Absent", icon: "✗" },
            { key: "HALF_DAY", label: "Half Day", icon: "◑" },
            { key: "LEAVE", label: "Leave", icon: "◌" },
          ] as { key: keyof typeof stats; label: string; icon: string }[]
        ).map(({ key, label, icon }) => (
          <div key={key} className={`ph-stat ph-stat--${key.toLowerCase().replace("_", "-")}`}>
            <span className="ph-stat__icon" aria-hidden="true">{icon}</span>
            <span className="ph-stat__count">{stats[key]}</span>
            <span className="ph-stat__label">{label}</span>
            <span className="ph-stat__period">last 30 days</span>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="ph-charts-row">
        {/* Attendance rate donut */}
        <div className="ph-chart-panel">
          <p className="ph-chart-panel__title">Attendance Rate</p>
          <div className="ph-ring-wrap">
            <svg viewBox="0 0 128 128" className="ph-ring" aria-hidden="true">
              <circle cx="64" cy="64" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
              <circle
                cx="64"
                cy="64"
                r={R}
                fill="none"
                stroke="var(--moss)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${CIRC - dash}`}
                strokeDashoffset={CIRC * 0.25}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <span className="ph-ring__label">{attendanceRate}%</span>
          </div>
          {/* mini legend */}
          <div className="ph-ring-legend">
            {pieData.map((d) => (
              <span key={d.name} className="ph-ring-legend__item">
                <span className="ph-ring-legend__dot" style={{ background: d.fill }} />
                {d.name} · {d.value}
              </span>
            ))}
          </div>
        </div>

        {/* Shift breakdown bar chart */}
        <div className="ph-chart-panel">
          <p className="ph-chart-panel__title">Shift Breakdown</p>
          {shiftCounts.length === 0 ? (
            <p className="ph-chart-panel__empty">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={shiftCounts} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-faint)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-soft)" }} width={72} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "var(--surface-sunk)" }}
                  contentStyle={{ border: "1px solid var(--line)", borderRadius: 3, fontSize: 12 }}
                />
                <Bar dataKey="count" name="Sessions" radius={[0, 3, 3, 0]}>
                  {shiftCounts.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 30-day heatmap */}
      <div className="ph-heatmap-panel">
        <p className="ph-chart-panel__title">30-Day Attendance Calendar</p>
        <div className="ph-heatmap">
          {days.map((day) => {
            const status = byDay.get(day);
            const tone = status
              ? status === "PRESENT"
                ? "present"
                : status === "HALF_DAY"
                ? "halfday"
                : status === "ABSENT"
                ? "absent"
                : "leave"
              : "none";
            return (
              <div
                key={day}
                className={`ph-heatmap__cell ph-heatmap__cell--${tone}`}
                title={`${day} · ${status ?? "No record"}`}
              />
            );
          })}
        </div>
        <div className="ph-heatmap-legend">
          {[
            { tone: "present", label: "Present" },
            { tone: "halfday", label: "Half Day" },
            { tone: "absent", label: "Absent" },
            { tone: "leave", label: "Leave" },
            { tone: "none", label: "No record" },
          ].map(({ tone, label }) => (
            <span key={tone} className="ph-heatmap-legend__item">
              <span className={`ph-heatmap__cell ph-heatmap__cell--${tone} ph-heatmap__cell--sm`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
