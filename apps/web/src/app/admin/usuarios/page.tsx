import { UsersAdmin } from "@/components/admin/users-admin";
import { apiFetch, requireUser } from "@/lib/api";
import { can, type PermissionInfo, type Role, type User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireUser("users.view", "users.manage");
  const [users, roles, catalog] = await Promise.all([
    apiFetch<User[]>("/users"),
    apiFetch<Role[]>("/roles"),
    // O catálogo só interessa a quem pode conceder permissões.
    can(me, "users.manage", "roles.manage") ? apiFetch<PermissionInfo[]>("/permissions") : Promise.resolve([]),
  ]);
  return <UsersAdmin me={me} initialUsers={users} roles={roles} catalog={catalog} />;
}
