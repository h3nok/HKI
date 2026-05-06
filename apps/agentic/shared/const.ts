export const COOKIE_NAME = "app_session_id";
/** Session TTL: 24 hours. Short-lived sessions limit token theft exposure. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24;
/** @deprecated Use SESSION_TTL_MS instead */
export const ONE_YEAR_MS = SESSION_TTL_MS;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
