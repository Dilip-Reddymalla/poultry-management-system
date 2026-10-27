import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InstallIcon } from "../components/icons.js";
import { Button } from "../components/ui.js";
import type { ButtonVariant } from "../components/ui.js";
import { useInstallPrompt } from "./useInstallPrompt.js";

/**
 * If the browser has a direct install prompt, clicking prompts immediately.
 * Otherwise, clicking navigates to the dedicated /install page with instructions.
 * Hides completely only when running inside an already installed standalone app.
 */
export function InstallButton({
  variant = "ghost",
  alwaysShow = false,
}: {
  variant?: ButtonVariant;
  alwaysShow?: boolean;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canInstall, isInstalled, install } = useInstallPrompt();

  // If already running as an installed standalone app, don't show the button
  if (isInstalled) {
    return null;
  }

  // If not running standalone, but canInstall is false and alwaysShow is false, hide
  if (!canInstall && !alwaysShow) {
    return null;
  }

  const handleClick = () => {
    if (canInstall) {
      void install();
    } else {
      navigate("/install");
    }
  };

  return (
    <Button
      variant={variant}
      className="install-button"
      aria-label={t("pwa.installApp")}
      onClick={handleClick}
      title={canInstall ? t("pwa.installApp") : "How to install app"}
    >
      <InstallIcon className="button__icon" />
      <span className="button__label">{t("pwa.installApp")}</span>
    </Button>
  );
}
