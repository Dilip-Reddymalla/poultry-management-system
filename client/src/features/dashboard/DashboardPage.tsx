import { Link } from "react-router-dom";

import { fetchEmployees, fetchFarms, fetchSheds } from "../../api/resources.js";
import type { Shed } from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { ShedLegend, ShedStrip } from "../../components/ShedStrip.js";
import {
  CardSkeleton,
  EmptyState,
  ErrorState,
  Panel,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { formatNumber } from "../../lib/display.js";

function Kpi({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}): React.ReactElement {
  return (
    <div className="kpi">
      <p className="kpi__label eyebrow">{label}</p>
      <p className="kpi__value numeric">{value}</p>
      <p className="kpi__detail">{detail}</p>
    </div>
  );
}

/** Sheds grouped by the farm they belong to, in farm code order. */
function groupByFarm(sheds: Shed[]): { farm: Shed["farm"]; sheds: Shed[] }[] {
  const groups = new Map<string, { farm: Shed["farm"]; sheds: Shed[] }>();

  for (const shed of sheds) {
    const group = groups.get(shed.farm.id) ?? { farm: shed.farm, sheds: [] };

    group.sheds.push(shed);
    groups.set(shed.farm.id, group);
  }

  return [...groups.values()]
    .map((group) => ({
      farm: group.farm,
      sheds: [...group.sheds].sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.farm.code.localeCompare(b.farm.code));
}

export function DashboardPage(): React.ReactElement {
  const { user, can } = useAuth();

  const canViewEmployees = can("employee:view");
  const canViewFarms = can("farm:view");
  const canViewSheds = can("shed:view");

  // Each read is gated on its own permission: the overview shows what this
  // user is allowed to see, and nothing else.
  const employees = useResource(
    "dashboard-employees",
    (signal) => fetchEmployees({ status: "ACTIVE", limit: 1 }, signal),
    { enabled: canViewEmployees },
  );

  const farms = useResource(
    "dashboard-farms",
    (signal) => fetchFarms("", signal),
    { enabled: canViewFarms },
  );

  const sheds = useResource("dashboard-sheds", (signal) => fetchSheds({}, signal), {
    enabled: canViewSheds,
  });

  const shedList = sheds.data ?? [];
  const activeFarms = (farms.data ?? []).filter(
    (farm) => farm.status === "ACTIVE",
  );
  const available = shedList.filter((shed) => shed.status === "AVAILABLE");
  const capacity = shedList.reduce((total, shed) => total + (shed.capacity ?? 0), 0);
  const groups = groupByFarm(shedList);

  const firstName = user?.employee.name.split(" ")[0] ?? "there";

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Overview"
        title={`Good day, ${firstName}`}
        description="Where the farms stand right now."
      />

      {!canViewEmployees && !canViewFarms && !canViewSheds ? (
        <Panel>
          <EmptyState
            title="Nothing to show yet"
            description="Your role does not include access to employees, farms or sheds. Ask a manager if you need it."
          />
        </Panel>
      ) : null}

      <div className="kpi-row">
        {canViewEmployees ? (
          employees.loading ? (
            <CardSkeleton />
          ) : employees.error ? (
            <ErrorState error={employees.error} onRetry={employees.reload} />
          ) : (
            <Kpi
              label="Active employees"
              value={formatNumber(employees.data?.pagination.total ?? 0)}
              detail="On the register today"
            />
          )
        ) : null}

        {canViewFarms ? (
          farms.loading ? (
            <CardSkeleton />
          ) : farms.error ? (
            <ErrorState error={farms.error} onRetry={farms.reload} />
          ) : (
            <Kpi
              label="Active farms"
              value={formatNumber(activeFarms.length)}
              detail={`${formatNumber(farms.data?.length ?? 0)} on record`}
            />
          )
        ) : null}

        {canViewSheds ? (
          sheds.loading ? (
            <CardSkeleton />
          ) : sheds.error ? (
            <ErrorState error={sheds.error} onRetry={sheds.reload} />
          ) : (
            <>
              <Kpi
                label="Sheds available"
                value={formatNumber(available.length)}
                detail={`of ${formatNumber(shedList.length)} sheds`}
              />
              <Kpi
                label="Bird capacity"
                value={formatNumber(capacity)}
                detail="Across every shed"
              />
            </>
          )
        ) : null}
      </div>

      {canViewSheds ? (
        <Panel
          eyebrow="Shed board"
          title="Every shed, farm by farm"
          actions={<ShedLegend />}
          bleed
        >
          {sheds.loading ? (
            <div className="panel__pad">
              <CardSkeleton />
            </div>
          ) : sheds.error ? (
            <div className="panel__pad">
              <ErrorState error={sheds.error} onRetry={sheds.reload} />
            </div>
          ) : groups.length === 0 ? (
            <div className="panel__pad">
              <EmptyState
                title="No sheds recorded"
                description="Sheds appear here as soon as they are added to a farm."
              />
            </div>
          ) : (
            <div className="board">
              {groups.map((group) => (
                <div className="board__row" key={group.farm.id}>
                  <div className="board__farm">
                    <Link className="board__code numeric" to="/sheds">
                      {group.farm.code}
                    </Link>
                    <span className="board__name">{group.farm.name}</span>
                  </div>
                  <ShedStrip sheds={group.sheds} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      ) : null}
    </div>
  );
}
