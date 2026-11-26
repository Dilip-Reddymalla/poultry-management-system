/**
 * Public API barrel.
 *
 * Re-exports every domain API module so existing imports keep working while the
 * actual code lives in cohesive, per-domain modules (high cohesion, low
 * coupling). Avoid adding new code here — add it to the relevant domain module.
 */
export * from "./reference.api.js";
export * from "./analytics.api.js";
export * from "./audit.api.js";
export * from "./face-ai-api.js";
export * from "./companies.api.js";
export * from "./farms.api.js";
export * from "./sheds.api.js";
export * from "./employees.api.js";
export * from "./workers.api.js";
export * from "./attendance.api.js";
