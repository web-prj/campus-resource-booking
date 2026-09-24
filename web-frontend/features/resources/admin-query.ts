export function adminResourcesHref(page: number): string {
  return page > 1 ? `/admin/resources?page=${page}` : "/admin/resources";
}
