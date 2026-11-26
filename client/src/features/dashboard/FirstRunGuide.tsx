import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../auth/use-auth.js";
import { CalendarIcon, ShedIcon, StatusReadyIcon } from "../../components/icons.js";
import { Button } from "../../components/ui.js";

/**
 * A short, plain-language "how do I start" card shown once on the dashboard.
 * It only lists the steps the signed-in role can actually do, so a supervisor
 * is pointed at recording attendance and a manager at reviewing numbers —
 * never at screens they cannot open. Dismissed once (kept in localStorage).
 */
const GUIDE_HIDDEN_KEY = "poultryops_guide_hidden";

export function FirstRunGuide(): React.ReactElement | null {
  const { t } = useTranslation();
  const { can } = useAuth();

  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem(GUIDE_HIDDEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  function dismiss(): void {
    try {
      localStorage.setItem(GUIDE_HIDDEN_KEY, "1");
    } catch {
      // Private mode etc. — just hide for this session.
    }
    setHidden(true);
  }

  const steps: React.ReactElement[] = [];
  if (can("attendance:create")) {
    steps.push(
      <li className="guide__item" key="record">
        <span className="guide__icon" aria-hidden="true">
          <StatusReadyIcon />
        </span>
        <span>{t("guide.stepRecord")}</span>
      </li>,
    );
  }
  if (can("attendance:view")) {
    steps.push(
      <li className="guide__item" key="check">
        <span className="guide__icon" aria-hidden="true">
          <CalendarIcon />
        </span>
        <span>{t("guide.stepCheck")}</span>
      </li>,
    );
  }
  if (can("shed:view")) {
    steps.push(
      <li className="guide__item" key="shed">
        <span className="guide__icon" aria-hidden="true">
          <ShedIcon />
        </span>
        <span>{t("guide.stepShed")}</span>
      </li>,
    );
  }

  return (
    <section className="guide" aria-label={t("guide.title")}>
      <div className="guide__content">
        <h2 className="guide__title">{t("guide.title")}</h2>
        <ul className="guide__list">{steps}</ul>
      </div>
      <Button variant="primary" onClick={dismiss} className="guide__dismiss">
        {t("guide.gotIt")}
      </Button>
    </section>
  );
}
