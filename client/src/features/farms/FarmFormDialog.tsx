import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  createFarm,
  fetchCompanies,
  updateFarm,
} from "../../api/resources.js";
import type { Company, Farm } from "../../api/types.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";

interface FarmFormDialogProps {
  /** Null means create. */
  farm: Farm | null;
  onClose: () => void;
  onSaved: (farm: Farm, mode: "created" | "updated") => void;
}

/** Mounted only while open, so the form starts clean every time. */
export function FarmFormDialog({
  farm,
  onClose,
  onSaved,
}: FarmFormDialogProps): React.ReactElement {
  const editing = farm !== null;

  // The owning company is fixed at creation, so it is only asked for once.
  const companies = useResource<Company[]>("companies", () => fetchCompanies(), {
    enabled: !editing,
  });

  const [companyId, setCompanyId] = useState(farm?.company.id ?? "");
  const [code, setCode] = useState(farm?.code ?? "");
  const [name, setName] = useState(farm?.name ?? "");
  const [latitude, setLatitude] = useState<string>(
    farm?.latitude !== undefined && farm?.latitude !== null ? String(farm.latitude) : "",
  );
  const [longitude, setLongitude] = useState<string>(
    farm?.longitude !== undefined && farm?.longitude !== null ? String(farm.longitude) : "",
  );
  const [geofenceRadius, setGeofenceRadius] = useState<string>(
    farm?.geofenceRadius !== undefined && farm?.geofenceRadius !== null
      ? String(farm.geofenceRadius)
      : "1000",
  );
  const [locating, setLocating] = useState(false);
  const [locatingMsg, setLocatingMsg] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  function handleDetectLocation(): void {
    if (!navigator.geolocation) {
      setLocatingMsg("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    setLocatingMsg(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
        setLocating(false);
        setLocatingMsg("GPS coordinates captured successfully");
      },
      (err) => {
        setLocating(false);
        setLocatingMsg(`Could not fetch location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const latVal = latitude.trim() ? parseFloat(latitude) : null;
    const lonVal = longitude.trim() ? parseFloat(longitude) : null;
    const geoVal = geofenceRadius.trim() ? parseFloat(geofenceRadius) : 1000;

    const payload = {
      code,
      name,
      latitude: latVal,
      longitude: lonVal,
      geofenceRadius: geoVal,
    };

    try {
      const saved = editing
        ? await updateFarm(farm.id, payload)
        : await createFarm({ companyId, ...payload });

      onSaved(saved, editing ? "updated" : "created");
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
      title={editing ? "Edit farm" : "Add farm"}
      description={
        editing
          ? "The owning company and status are managed elsewhere."
          : "A farm holds the sheds that birds are placed in."
      }
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {companies.error ? <FormAlert error={companies.error} /> : null}

        {editing ? null : companies.loading ? (
          <p className="field__hint">
            <Spinner label="Loading companies" /> Loading companies…
          </p>
        ) : (
          <SelectField
            id="farm-company"
            label="Company"
            required
            value={companyId}
            errors={error?.fieldErrors.companyId}
            onChange={(event) => {
              setCompanyId(event.target.value);
            }}
          >
            <option value="">Select a company</option>
            {(companies.data ?? []).map((company) => (
              <option key={company.id} value={company.id}>
                {company.code} — {company.name}
              </option>
            ))}
          </SelectField>
        )}

        <TextField
          id="farm-code"
          label="Farm code"
          required
          value={code}
          hint="Short code used on paperwork, for example F-01."
          errors={error?.fieldErrors.code}
          onChange={(event) => {
            setCode(event.target.value);
          }}
        />

        <TextField
          id="farm-name"
          label="Farm name"
          required
          value={name}
          errors={error?.fieldErrors.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />

        <div style={{ marginTop: "1rem", padding: "0.75rem", border: "1px solid var(--border-color, #e2e8f0)", borderRadius: "8px", background: "var(--card-bg, #f8fafc)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Farm Geofencing & GPS Location</span>
            <Button
              type="button"
              variant="secondary"
              busy={locating}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
              onClick={handleDetectLocation}
            >
              📍 Detect Current Location
            </Button>
          </div>
          {locatingMsg ? (
            <p style={{ fontSize: "0.75rem", color: locatingMsg.startsWith("Could") ? "var(--color-danger, #ef4444)" : "var(--color-success, #10b981)", marginBottom: "0.5rem" }}>
              {locatingMsg}
            </p>
          ) : null}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <TextField
              id="farm-latitude"
              label="Latitude"
              type="number"
              step="any"
              value={latitude}
              placeholder="e.g. 17.385044"
              errors={error?.fieldErrors.latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
            <TextField
              id="farm-longitude"
              label="Longitude"
              type="number"
              step="any"
              value={longitude}
              placeholder="e.g. 78.486671"
              errors={error?.fieldErrors.longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />
          </div>

          <div style={{ marginTop: "0.5rem" }}>
            <TextField
              id="farm-geofence"
              label="Geofence Radius (meters)"
              type="number"
              min={50}
              max={50000}
              value={geofenceRadius}
              hint="Default: 1000m (1 KM). Attendance marked beyond this radius flags for manager approval with location offset."
              errors={error?.fieldErrors.geofenceRadius}
              onChange={(e) => setGeofenceRadius(e.target.value)}
            />
          </div>
        </div>

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            {editing ? "Save changes" : "Add farm"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
