import "server-only";

import { cookies } from "next/headers";
import { getApiEndpoint } from "@/lib/api/config";
import { parseUser } from "../schema";
import type { User } from "../types";

export async function getCurrentUser(request: typeof fetch = fetch): Promise<User | null> {
  const cookieHeader = (await cookies()).toString();
  let response: Response;

  try {
    response = await request(getApiEndpoint("/auth/me"), {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("The booking service is unavailable.");
  }

  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session lookup failed with ${response.status}.`);

  const user = parseUser(await response.json().catch(() => null));
  if (!user) throw new Error("The booking service returned an invalid session.");
  return user;
}
