import type React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/use-auth.js";

/**
 * A short, plain-language "how do I start" card on the dashboard. It lists the
 * steps the signed-in role can actually do, so a supervisor is pointed at
 * recording attendance and a manager at reviewing numbers — never at screens
 * they cannot open. Permanently visible; no dismiss state.
 */
export function FirstRunGuide(): React.ReactElement {
  const { t } = useTranslation();
  const { can } = useAuth();

  const steps: React.ReactElement[] = [];
  if (can("attendance:create")) {
    steps.push(
      <li className="guide__item" key="record">
        <Link className="button button--secondary" to="/attendance/face">
          📸 {t("guide.stepRecord")}
        </Link>
      </li>,
    );
  }
  if (can("attendance:view")) {
    steps.push(
      <li className="guide__item" key="check">
        <Link className="button button--secondary" to="/attendance">
          📋 {t("guide.stepCheck")}
        </Link>
      </li>,
    );
  }
  if (can("shed:view")) {
    steps.push(
      <li className="guide__item" key="shed">
        <Link className="button button--secondary" to="/sheds">
          🏠 {t("guide.stepShed")}
        </Link>
      </li>,
    );
  }

  return (
    <section className="guide" aria-label={t("guide.title")}>
      <div className="guide__content">
        <h2 className="guide__title">{t("guide.title")}</h2>
        <ul className="guide__list">{steps}</ul>
      </div>
    </section>
  );
}
