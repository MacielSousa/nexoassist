import { RolesAdmin } from "@/components/admin/roles-admin";
import { apiFetch, requireUser } from "@/lib/api";
import type { PermissionInfo, Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const me = await requireUser("roles.manage");
  const [roles, catalog] = await Promise.all([apiFetch<Role[]>("/roles"), apiFetch<PermissionInfo[]>("/permissions")]);
  return <RolesAdmin me={me} initialRoles={roles} catalog={catalog} />;
}
