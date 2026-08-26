import { useState } from "react";

import { ApiError } from "../../api/client.js";
import {
  createAttendance,
  fetchEmployees,
  fetchFarms,
  fetchSheds,
  fetchWorkers,
  fetchMarkedPersonIds,
  type AttendanceInput,
  type EmployeeListResult,
  type WorkerListResult,
} from "../../api/resources.js";
import type {
  Attendance,
  AttendanceStatus,
  Farm,
  Shed,
  Shift,
  PersonType,
} from "../../api/types.js";
import { useAuth } from "../../auth/use-auth.js";
import { Dialog } from "../../components/Dialog.js";
import {
  Button,
  FormAlert,
  SelectField,
  Spinner,
  TextField,
} from "../../components/ui.js";
import { useResource } from "../../hooks/useResource.js";
import { useGeolocation } from "../../hooks/useGeolocation.js";
import { StatusChoice } from "./StatusChoice.js";
import { ShiftChoice } from "./ShiftChoice.js";

interface AttendanceEntryDialogProps {
  defaultDate: string;
  defaultFarmId?: string | null;
  onClose: () => void;
  onSaved: (record: Attendance) => void;
}

const PERSON_TABS: { type: PersonType; label: string }[] = [
  { type: "EMPLOYEE", label: "Employee" },
  { type: "WORKER", label: "Worker" },
];

export function AttendanceEntryDialog({
  defaultDate,
  defaultFarmId,
  onClose,
  onSaved,
}: AttendanceEntryDialogProps): React.ReactElement {
  const { user } = useAuth();
  const pickFarm =
    user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";

  const [date, setDate] = useState(defaultDate);
  const [shift, setShift] = useState<Shift>("MORNING_SHIFT");
  const [personType, setPersonType] = useState<PersonType>("EMPLOYEE");
  const [chosenFarmId, setChosenFarmId] = useState(defaultFarmId ?? "");
  const [personId, setPersonId] = useState("");
  const [shedId, setShedId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [missingPerson, setMissingPerson] = useState(false);
  const [busy, setBusy] = useState(false);

  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms());
  const farmOptions = farms.data ?? [];
  const soleFarmId = farmOptions.length === 1 ? farmOptions[0]!.id : "";
  const farmId = chosenFarmId || soleFarmId;

  const sheds = useResource<Shed[]>(
    `sheds:picker:${farmId}`,
    () => fetchSheds({ farmId, status: "AVAILABLE" }),
    { enabled: farmId !== "" }
  );

  const markedIds = useResource(
    `marked-ids:${date}:${shift}:${farmId}`,
    (signal) => fetchMarkedPersonIds({ date, shift, farmId }, signal),
    { enabled: farmId !== "" && date !== "" && shift !== undefined }
  );

  const employees = useResource<EmployeeListResult>(
    `entry-employees:${farmId}:${search}`,
    (signal) =>
      fetchEmployees(
        { farmId, status: "ACTIVE", search, limit: 100, page: 1 },
        signal,
      ),
    { enabled: personType === "EMPLOYEE" && farmId !== "" },
  );

  const workers = useResource<WorkerListResult>(
    `entry-workers:${farmId}:${search}`,
    (signal) =>
      fetchWorkers({ farmId, status: "ACTIVE", search, limit: 100, page: 1 }, signal),
    { enabled: personType === "WORKER" && farmId !== "" },
  );

  const peopleLoading =
    (personType === "EMPLOYEE" ? employees.loading : workers.loading) || markedIds.loading;
  
  const peopleError =
    personType === "EMPLOYEE" ? employees.error : workers.error;
  
  const markedEmployeeSet = new Set(markedIds.data?.employeeIds ?? []);
  const markedWorkerSet = new Set(markedIds.data?.workerIds ?? []);

  const people =
    personType === "EMPLOYEE"
      ? (employees.data?.employees ?? [])
          .filter(p => !markedEmployeeSet.has(p.id))
          .map((p) => ({
            id: p.id,
            label: `${p.name} · ${p.employeeId}`,
          }))
      : (workers.data?.workers ?? [])
          .filter(p => !markedWorkerSet.has(p.id))
          .map((p) => ({
            id: p.id,
            label: `${p.name} · ${p.workerId}`,
          }));

  function switchType(next: PersonType): void {
    setPersonType(next);
    setPersonId("");
    setMissingPerson(false);
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    if (personId === "") {
      setMissingPerson(true);
      return;
    }

    if (latitude === null || longitude === null) {
      setError(new ApiError(0, "Location is required to mark attendance. Please allow location access."));
      return;
    }

    setBusy(true);
    setError(null);

    const payload: AttendanceInput = {
      date,
      shift,
      status,
      latitude,
      longitude,
      ...(shedId !== "" ? { shedId } : {}),
      ...(personType === "EMPLOYEE"
        ? { employeeId: personId }
        : { workerId: personId }),
      ...(notes.trim() !== "" && { notes: notes.trim() }),
    };

    try {
      const saved = await createAttendance(payload);
      onSaved(saved);
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
      title="Record attendance"
      description="Record attendance with GPS location. Shift determines uniqueness."
      onClose={onClose}
    >
      <form className="dialog__form" onSubmit={handleSubmit} noValidate>
        <FormAlert error={error} />
        {farms.error ? <FormAlert error={farms.error} /> : null}
        
        {locationError && (
          <div className="alert alert--danger">
            <strong>Location Required:</strong> {locationError}
          </div>
        )}
        {locationLoading && (
          <p className="field__hint"><Spinner label="Getting location" /> Waiting for GPS location...</p>
        )}

        <TextField
          id="attendance-date"
          label="Date"
          type="date"
          required
          value={date}
          errors={error?.fieldErrors?.date}
          onChange={(event) => {
            setDate(event.target.value);
            setPersonId("");
          }}
        />

        <ShiftChoice 
          value={shift} 
          onChange={(v) => { setShift(v); setPersonId(""); }} 
          errors={error?.fieldErrors?.shift} 
        />

        {pickFarm && !soleFarmId ? (
          farms.loading ? (
            <p className="field__hint">
              <Spinner label="Loading farms" /> Loading farms…
            </p>
          ) : (
            <SelectField
              id="attendance-farm"
              label="Farm"
              required
              value={farmId}
              hint="Pick the farm, then the person on it."
              onChange={(event) => {
                setChosenFarmId(event.target.value);
                setPersonId("");
              }}
            >
              <option value="">Select a farm</option>
              {farmOptions.map((farm) => (
                <option key={farm.id} value={farm.id}>
                  {farm.code} — {farm.name}
                </option>
              ))}
            </SelectField>
          )
        ) : null}

        <SelectField
          id="attendance-shed"
          label="Shed"
          value={shedId}
          hint="Optional. Pick the shed this person is working in."
          disabled={farmId === "" || sheds.loading}
          onChange={(event) => setShedId(event.target.value)}
        >
          <option value="">No specific shed</option>
          {(sheds.data ?? []).map((shed) => (
            <option key={shed.id} value={shed.id}>
              Shed {shed.number}
            </option>
          ))}
        </SelectField>

        <div className="field">
          <span className="field__label">Person</span>
          <div className="segmented" role="group" aria-label="Person type">
            {PERSON_TABS.map((tab) => (
              <button
                key={tab.type}
                type="button"
                className={
                  personType === tab.type
                    ? "segmented__item segmented__item--active"
                    : "segmented__item"
                }
                aria-pressed={personType === tab.type}
                onClick={() => {
                  switchType(tab.type);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <TextField
          id="attendance-search"
          label="Search person"
          value={search}
          placeholder="Type name or code..."
          disabled={farmId === ""}
          onChange={(event) => setSearch(event.target.value)}
        />

        {peopleError ? <FormAlert error={peopleError} /> : null}

        {peopleLoading ? (
          <p className="field__hint">
            <Spinner label="Loading people" /> Loading{" "}
            {personType === "EMPLOYEE" ? "employees" : "workers"}…
          </p>
        ) : (
          <SelectField
            id="attendance-person"
            label={personType === "EMPLOYEE" ? "Employee" : "Worker"}
            required
            value={personId}
            errors={
              missingPerson
                ? ["Pick who this record is for."]
                : (error?.fieldErrors?.employeeId ??
                  error?.fieldErrors?.workerId)
            }
            hint={
              farmId === ""
                ? "Choose a farm first."
                : people.length === 0
                  ? "No available unrecorded people match."
                  : undefined
            }
            disabled={farmId === "" || people.length === 0}
            onChange={(event) => {
              setPersonId(event.target.value);
              setMissingPerson(false);
            }}
          >
            <option value="">
              Select {personType === "EMPLOYEE" ? "an employee" : "a worker"}
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </SelectField>
        )}

        <StatusChoice
          value={status}
          onChange={setStatus}
          errors={error?.fieldErrors?.status}
        />

        <TextField
          id="attendance-notes"
          label="Notes"
          value={notes}
          hint="Optional. A short reason for leave or a half day, for example."
          errors={error?.fieldErrors?.notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />

        <div className="dialog__footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy || locationLoading || latitude === null || longitude === null}>
            Save record
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
