/**
 * Transaction-scoped advisory lock serializing every change that can alter the
 * set of active administrators (last-admin guard, first-admin bootstrap).
 */
export const ACTIVE_ADMIN_ADVISORY_LOCK = 2_045_173_001;
