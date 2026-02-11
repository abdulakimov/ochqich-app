import { cookies } from "next/headers";

const SESSION_COOKIE = "dashboard_session";

export function isLoggedIn() {
  return cookies().get(SESSION_COOKIE)?.value === "active";
}

export function requireAuth() {
  return isLoggedIn();
}

export const sessionCookieName = SESSION_COOKIE;
