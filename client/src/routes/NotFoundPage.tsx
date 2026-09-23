import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { EmptyState, Panel } from "../components/ui.js";
import { PageHeader } from "../layout/PageHeader.js";

export function NotFoundPage(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <div className="stack">
      <PageHeader title={t("notFound.pageTitle")} />
      <Panel>
        <EmptyState
          title={t("notFound.title")}
          description={t("notFound.description")}
          action={
            <Link className="button button--primary" to="/dashboard">
              {t("notFound.goToOverview")}
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
