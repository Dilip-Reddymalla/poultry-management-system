import { InstallIcon } from "../components/icons.js";
import { Button } from "../components/ui.js";
import type { ButtonVariant } from "../components/ui.js";
import { useInstallPrompt } from "./useInstallPrompt.js";

/**
 * Renders nothing unless the browser has offered installation, so there is no
 * dead control on Firefox, on iOS, or in an already-installed window.
 */
export function InstallButton({
  variant = "ghost",
}: {
  variant?: ButtonVariant;
}): React.ReactElement | null {
  const { canInstall, install } = useInstallPrompt();

  if (!canInstall) {
    return null;
  }

  return (
    <Button
      variant={variant}
      className="install-button"
      aria-label="Install app"
      onClick={() => {
        void install();
      }}
    >
      <InstallIcon className="button__icon" />
      <span className="button__label">Install app</span>
    </Button>
  );
}
