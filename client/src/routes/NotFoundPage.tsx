import { Link } from "react-router-dom";

import { EmptyState, Panel } from "../components/ui.js";
import { PageHeader } from "../layout/PageHeader.js";

export function NotFoundPage(): React.ReactElement {
  return (
    <div className="stack">
      <PageHeader title="Page not found" />
      <Panel>
        <EmptyState
          title="That screen does not exist"
          description="The link may be out of date. Head back to the overview."
          action={
            <Link className="button button--primary" to="/dashboard">
              Go to overview
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
