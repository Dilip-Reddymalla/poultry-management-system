interface Props {
  permissions: string[];
}

/** Groups `resource:action` permissions by their resource. */
function groupPermissions(permissions: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const permission of [...permissions].sort()) {
    const [resource = "other", action = permission] = permission.split(":");
    groups.set(resource, [...(groups.get(resource) ?? []), action]);
  }
  return [...groups.entries()];
}

export function ProfilePermissionsPanel({ permissions }: Props): React.ReactElement {
  const groups = groupPermissions(permissions);

  return (
    <div className="ph-perms">
      <div className="ph-perms__header">
        <p className="eyebrow">Permissions</p>
        <span className="ph-perms__badge">{permissions.length} total</span>
      </div>

      {groups.length === 0 ? (
        <p className="ph-perms__empty">No permissions assigned yet. Ask a manager to assign a role.</p>
      ) : (
        <ul className="ph-perms__list">
          {groups.map(([resource, actions]) => (
            <li className="ph-perms__group" key={resource}>
              <p className="ph-perms__resource">{resource}</p>
              <ul className="ph-perms__actions">
                {actions.map((action) => (
                  <li className="ph-perms__chip" key={action}>
                    {action.replace(/-/g, " ")}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
