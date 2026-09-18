import { useState } from "react";

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
          newPassword: ["New password must be at least 8 characters"],
        }),
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        new ApiError(400, "Validation error", {
          confirmPassword: ["Passwords do not match"],
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
      notify("success", "Password changed successfully.");
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError(0, "Something went wrong."),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title="Change password"
      description="Enter your current password and choose a new password with at least 8 characters."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <TextField
          id="current-password"
          label="Current password"
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
          label="New password"
          type={showPasswords ? "text" : "password"}
          autoComplete="new-password"
          required
          value={newPassword}
          hint="Must be at least 8 characters long."
          errors={error?.fieldErrors.newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
          }}
        />

        <TextField
          id="confirm-password"
          label="Confirm new password"
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
            {showPasswords ? "Hide passwords" : "Show passwords"}
          </button>
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Update password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
