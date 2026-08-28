import { useState } from "react";
import { fetchEmployees, fetchWorkers, bulkCreateAttendance, fetchSheds, fetchFarms, fetchMarkedPersonIds, type EmployeeListResult, type WorkerListResult } from "../../api/resources.js";
import type {
  AttendanceStatus,
  Farm,
  Shed,
  Shift,
  PersonType,
} from "../../api/types.js";
import { ATTENDANCE_STATUSES } from "../../api/types.js";
import { Button, Spinner } from "../../components/ui.js";
import { Dialog } from "../../components/Dialog.js";
import { useToast } from "../../components/use-toast.js";
import { useResource } from "../../hooks/useResource.js";
import { useGeolocation } from "../../hooks/useGeolocation.js";
import { statusLabel } from "../../lib/display.js";
import { useAuth } from "../../auth/use-auth.js";
import { ShiftChoice } from "./ShiftChoice.js";


interface BulkAttendanceDialogProps {
  defaultDate: string;
  defaultFarmId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function BulkAttendanceDialog({
  defaultDate,
  defaultFarmId,
  onClose,
  onSaved,
}: BulkAttendanceDialogProps): React.ReactElement {
  const { user } = useAuth();
  const { notify } = useToast();
  const showFarm = user?.scope.level === "COMPANY" || user?.scope.level === "GLOBAL";
  
  const [date, setDate] = useState(defaultDate);
  const [shift, setShift] = useState<Shift>("MORNING_SHIFT");
  const [chosenFarmId, setChosenFarmId] = useState(defaultFarmId ?? "");
  const [shedId, setShedId] = useState("");
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [personType, setPersonType] = useState<PersonType>("EMPLOYEE");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { latitude, longitude, error: locationError, loading: locationLoading } = useGeolocation();

  const farms = useResource<Farm[]>("farms:picker", () => fetchFarms(), {
    enabled: showFarm,
  });
  const farmOptions = farms.data ?? [];
  const soleFarmId = farmOptions.length === 1 ? farmOptions[0]!.id : "";
  const farmId = chosenFarmId || defaultFarmId || soleFarmId || (user?.scope.farmId ?? "");

  const sheds = useResource<Shed[]>(
    `sheds:picker:${farmId}`,
    () => fetchSheds(farmId ? { farmId, status: "AVAILABLE" } : { status: "AVAILABLE" })
  );

  const markedIds = useResource(
    `marked-ids:${date}:${shift}:${farmId}`,
    (signal) => fetchMarkedPersonIds(farmId ? { date, shift, farmId } : { date, shift } as any, signal),
    { enabled: date !== "" && shift !== undefined }
  );

  const employees = useResource<EmployeeListResult>(
    `employees:bulk:${farmId}:${search}:${personType}`,
    (signal) => fetchEmployees(
      farmId ? { farmId, status: "ACTIVE", search, limit: 100 } : { status: "ACTIVE", search, limit: 100 },
      signal,
    ),
    { enabled: personType === "EMPLOYEE" }
  );

  const workers = useResource<WorkerListResult>(
    `workers:bulk:${farmId}:${search}:${personType}`,
    (signal) => fetchWorkers(
      farmId ? { farmId, status: "ACTIVE", search, limit: 100 } : { status: "ACTIVE", search, limit: 100 },
      signal
    ),
    { enabled: personType === "WORKER" }
  );

  const markedEmployeeSet = new Set(markedIds.data?.employeeIds ?? []);
  const markedWorkerSet = new Set(markedIds.data?.workerIds ?? []);

  const allPeople = [
    ...(employees.data?.employees || [])
      .filter(e => !markedEmployeeSet.has(e.id))
      .map(e => ({ type: "EMPLOYEE" as const, id: e.id, name: e.name, code: e.employeeId, phone: e.phone })),
    ...(workers.data?.workers || [])
      .filter(w => !markedWorkerSet.has(w.id))
      .map(w => ({ type: "WORKER" as const, id: w.id, name: w.name, code: w.workerId, phone: w.phone }))
  ];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(allPeople.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) newSet.add(id);
    else newSet.delete(id);
    setSelectedIds(newSet);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedIds.size === 0) return;

    if (latitude === null || longitude === null) {
      notify("error", "Location is required to mark attendance. Please allow location access.");
      return;
    }

    setSaving(true);
    try {
      const records = Array.from(selectedIds).map(id => {
        const person = allPeople.find(p => p.id === id)!;
        return {
          date,
          shift,
          ...(shedId ? { shedId } : {}),
          status,
          latitude,
          longitude,
          ...(person.type === "EMPLOYEE" ? { employeeId: person.id } : { workerId: person.id })
        };
      });

      const response = await bulkCreateAttendance({ records });
      
      const fulfilled = response.results.filter(r => r.status === "fulfilled").length;
      const rejected = response.results.filter(r => r.status === "rejected").length;
      
      if (rejected > 0) {
        if (fulfilled > 0) {
          notify("error", `Saved ${fulfilled} records. Failed to save ${rejected} records (likely already recorded).`);
        } else {
          notify("error", "Failed to save records. They might already exist.");
        }
      } else {
        notify("success", `Successfully marked attendance for ${fulfilled} people.`);
      }
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save bulk attendance.";
      notify("error", message);
      setSaving(false);
    }
  };

  return (
    <Dialog title="Bulk Attendance" onClose={onClose}>
      <form className="stack" onSubmit={handleSubmit}>
        
        {locationError && (
          <div className="alert alert--danger" style={{ marginBottom: '1rem' }}>
            <strong>Location Required:</strong> {locationError}
          </div>
        )}
        {locationLoading && (
          <p className="field__hint"><Spinner label="Getting location" /> Waiting for GPS location...</p>
        )}

        <div className="filters">
          <label className="filters__field">
            Date
            <input type="date" className="input" value={date} onChange={(e) => { setDate(e.target.value); setSelectedIds(new Set()); }} required />
          </label>
          {showFarm && !soleFarmId && (
            <label className="filters__field">
              Farm
              <select className="input select" value={farmId} onChange={(e) => { setChosenFarmId(e.target.value); setShedId(""); setSelectedIds(new Set()); }} required>
                <option value="">Select Farm</option>
                {farms.data?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
          )}
          <label className="filters__field">
            Shed
            <select className="input select" value={shedId} onChange={(e) => setShedId(e.target.value)}>
              <option value="">No specific shed</option>
              {sheds.data?.map(s => <option key={s.id} value={s.id}>Shed {s.number}</option>)}
            </select>
          </label>
        </div>

        <ShiftChoice 
          value={shift} 
          onChange={(v) => { setShift(v); setSelectedIds(new Set()); }} 
        />

        <div className="filters">
          <label className="filters__field">
            Person Type
            <select
              className="input select"
              value={personType}
              onChange={(e) => {
                setPersonType(e.target.value as PersonType);
                setSelectedIds(new Set());
              }}
            >
              <option value="EMPLOYEE">Employees</option>
              <option value="WORKER">Workers</option>
            </select>
          </label>
          <label className="filters__field">
            Search
            <input type="text" className="input" placeholder="Search name or code..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="filters__field">
            Status to apply
            <select className="input select" value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
              {ATTENDANCE_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
            </select>
          </label>
        </div>

        <div className="panel__pad" style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border-subtle)", marginTop: "1rem" }}>
          {employees.loading || workers.loading || markedIds.loading ? (
            <p><Spinner label="Loading" /> Loading...</p>
          ) : allPeople.length === 0 ? (
            <p>No available unrecorded people found.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.size === allPeople.length && allPeople.length > 0} 
                      onChange={(e) => handleSelectAll(e.target.checked)} 
                    />
                  </th>
                  <th>Person</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {allPeople.map(person => (
                  <tr key={person.id}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(person.id)} 
                        onChange={(e) => handleSelect(person.id, e.target.checked)} 
                      />
                    </td>
                    <td>{person.name} <span className="muted">({person.code})</span></td>
                    <td>{person.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="dialog__actions" style={{ marginTop: "1.5rem" }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving || selectedIds.size === 0 || latitude === null || longitude === null || locationLoading}>
            {saving ? "Saving..." : `Mark Selected (${selectedIds.size})`}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
