import { useState } from "react";
import { useTranslation } from "react-i18next";

import { changePassword } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert, TextField } from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";

interface ChangePasswordDialogProps {
  onClose: () => void;
}

export function ChangePasswordDialog({
  onClose,
}: ChangePasswordDialogProps): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const { notify } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (newPassword.length < 8) {
      setError(
        new ApiError(400, "Validation error", {
          newPassword: [t("profile.changePasswordDialog.validationTooShort")],
        }),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        new ApiError(400, "Validation error", {
          confirmPassword: [t("profile.changePasswordDialog.validationMismatch")],
        }),
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await changePassword(currentPassword, newPassword);
      if (response.user) {
        setSession(response.user);
      }
      notify("success", t("profile.changePasswordDialog.changedSuccess"));
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, t("error.somethingWentWrong")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={t("profile.changePasswordDialog.title")}
      description={t("profile.changePasswordDialog.description")}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <TextField
          id="current-password"
          label={t("profile.changePasswordDialog.currentPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="current-password"
          required
          value={currentPassword}
          errors={error?.fieldErrors.currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value);
          }}
        />

        <TextField
          id="new-password"
          label={t("profile.changePasswordDialog.newPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          value={newPassword}
          hint={t("profile.changePasswordDialog.newPasswordHint")}
          errors={error?.fieldErrors.newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
          }}
        />

        <TextField
          id="confirm-password"
          label={t("profile.changePasswordDialog.confirmNewPassword")}
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          value={confirmPassword}
          errors={error?.fieldErrors.confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "var(--color-primary-600, #2563eb)",
            }}
            onClick={() => setShowPasswords(!showPasswords)}
          >
            {showPasswords
              ? t("profile.changePasswordDialog.hidePasswords")
              : t("profile.changePasswordDialog.showPasswords")}
          </button>
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {t("profile.changePasswordDialog.updateButton")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
