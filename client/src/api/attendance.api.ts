// Re-export attendance utilities from the consolidated resources module.
// This file exists for backwards compatibility with imports that reference it.
export {
  fetchMarkedPersonIds,
  exportAttendanceUrl,
} from "./resources.js";

export type {
  ExportAttendanceQuery,
  MarkedPersonIdsQuery,
  MarkedPersonIdsResponse,
} from "./resources.js";
