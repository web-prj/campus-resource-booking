import { getApiUrl } from "./config";

export function getServerApiEndpoint(path: string): string {
  const apiUrl = (process.env.INTERNAL_API_URL || getApiUrl()).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${apiUrl}${normalizedPath}`;
}
