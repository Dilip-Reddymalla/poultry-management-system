import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/use-auth.js";
import { Button } from "../../components/ui.js";

/**
 * A short, plain-language "how do I start" card shown once on the dashboard.
 * It only lists the steps the signed-in role can actually do, so a supervisor
 * is pointed at recording attendance and a manager at reviewing numbers —
 * never at screens they cannot open. Dismissed once (kept in localStorage).
 */
const GUIDE_HIDDEN_KEY = "poultryops_guide_hidden";

/**
 * Illustrated, text-free 3-step demo of the core daily flow: phone → camera →
 * checkmark. Loops via CSS so it communicates without reading. The real,
 * actionable buttons are rendered below it from `steps`.
 */
function FlowDemo(): React.ReactElement {
  return (
    <div className="guide__flow" aria-hidden="true">
      <span className="guide__flow-step guide__flow-step--phone">📱</span>
      <span className="guide__flow-arrow">➡️</span>
      <span className="guide__flow-step guide__flow-step--camera">📸</span>
      <span className="guide__flow-arrow">➡️</span>
      <span className="guide__flow-step guide__flow-step--done">✅</span>
    </div>
  );
}

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
        <FlowDemo />
        <ul className="guide__list">{steps}</ul>
      </div>
      <Button variant="primary" onClick={dismiss} className="guide__dismiss">
        {t("guide.gotIt")}
      </Button>
    </section>
  );
}
