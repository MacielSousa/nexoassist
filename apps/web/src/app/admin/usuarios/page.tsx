import { UsersAdmin } from "@/components/admin/users-admin";
import { apiFetch, requireUser } from "@/lib/api";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const admin = await requireUser("admin");
  const users = await apiFetch<User[]>("/users");
  return <UsersAdmin admin={admin} initialUsers={users} />;
}
