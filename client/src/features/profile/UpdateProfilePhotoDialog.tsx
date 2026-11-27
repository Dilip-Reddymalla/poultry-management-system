import { useState } from "react";
import { useTranslation } from "react-i18next";

import { updateProfilePhoto } from "../../api/auth.js";
import { ApiError } from "../../api/client.js";
import { useAuth } from "../../auth/use-auth.js";
import { CameraPhotoInput } from "../../components/CameraPhotoInput.js";
import { Dialog } from "../../components/Dialog.js";
import { Button, FormAlert } from "../../components/ui.js";
import { useToast } from "../../components/use-toast.js";

interface Props {
  currentPhotoUrl?: string | null;
  onClose: () => void;
}

export function UpdateProfilePhotoDialog({
  currentPhotoUrl,
  onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const { notify } = useToast();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!photoFile) return;

    setBusy(true);
    setError(null);

    try {
      const data = await updateProfilePhoto(photoFile);
      setSession(data.user);
      notify("success", t("profile.photoUpdated", { defaultValue: "Profile photo updated." }));
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
      title={`📷 ${t("profile.updatePhoto", { defaultValue: "Update photo" })}`}
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />

        <CameraPhotoInput
          currentPhotoUrl={currentPhotoUrl ?? null}
          onChange={setPhotoFile}
        />

        <div className="dialog__footer">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="success" busy={busy} disabled={!photoFile}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
