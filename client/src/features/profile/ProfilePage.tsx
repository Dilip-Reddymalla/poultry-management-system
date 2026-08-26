import { useAuth } from "../../auth/use-auth.js";
import { DetailList, EmptyState, Panel } from "../../components/ui.js";
import { PageHeader } from "../../layout/PageHeader.js";
import { initials } from "../../lib/display.js";
import { AttendancePage } from "../attendance/AttendancePage.js";

/** Groups `resource:action` permissions by their resource. */
function groupPermissions(permissions: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();

  for (const permission of [...permissions].sort()) {
    const [resource = "other", action = permission] = permission.split(":");

    groups.set(resource, [...(groups.get(resource) ?? []), action]);
  }

  return [...groups.entries()];
}

export function ProfilePage(): React.ReactElement {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="stack">
        <PageHeader title="My profile" />
        <Panel>
          <EmptyState
            title="No session"
            description="Sign in again to see your profile."
          />
        </Panel>
      </div>
    );
  }

  const groups = groupPermissions(user.permissions);

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="What the app knows about you and what your role lets you do."
      />

      <div className="split">
        <Panel title="You">
          <div className="profile">
            <span className="avatar avatar--lg" aria-hidden="true">
              {initials(user.employee.name)}
            </span>
            <div>
              <p className="profile__name">{user.employee.name}</p>
              <p className="profile__meta">{user.employee.designation.name}</p>
            </div>
          </div>

          <DetailList
            items={[
              { label: "Email", value: user.email },
              {
                label: "Employee ID",
                value: <span className="numeric">{user.employeeId}</span>,
              },
              {
                label: "Roles",
                value:
                  user.roles.length > 0 ? user.roles.join(", ") : "None assigned",
              },
            ]}
          />
        </Panel>

        <Panel
          eyebrow={`${user.permissions.length} in total`}
          title="What you can do"
        >
          {groups.length === 0 ? (
            <EmptyState
              title="No permissions yet"
              description="Ask a manager to assign a role with the access you need."
            />
          ) : (
            <ul className="permlist">
              {groups.map(([resource, actions]) => (
                <li className="permlist__group" key={resource}>
                  <p className="permlist__resource">{resource}</p>
                  <ul className="permlist__actions">
                    {actions.map((action) => (
                      <li className="chip" key={action}>
                        {action.replace(/-/g, " ")}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {user.employee?.id ? (
        <div style={{ marginTop: "2rem" }}>
          <PageHeader title="My Attendance" description="Review your own attendance history." />
          <AttendancePage employeeId={user.employee.id} />
        </div>
      ) : null}
    </div>
  );
}
