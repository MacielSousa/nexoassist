import { KeyRound } from "lucide-react";
import { EmployeeShell } from "@/components/employee-shell";
import { ProfileForm } from "@/components/profile/profile-form";
import { StaffShell } from "@/components/staff-shell";
import { requireUser } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

/** Meu perfil: para todos os perfis (funcionário usa o layout do chat; equipe de TI, o da equipe). */
export default async function ProfilePage() {
  const user = await requireUser();
  const content = (
    <div className="flex-1 overflow-y-auto px-4 py-10 sm:px-10">
      <div className="flex max-w-[680px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold">Meu perfil</h1>
          <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
        </div>

        <ProfileForm initial={user} />

        <section className="overflow-hidden rounded-2xl border border-ink/9">
          <div className="flex items-center gap-4 p-6">
            <span className="grid size-10 place-items-center rounded-full bg-desk text-ink-2">
              <KeyRound size={18} />
            </span>
            <span className="flex flex-1 flex-col gap-[3px]">
              <span className="text-[14.5px] font-semibold">Senha</span>
              <span className="text-[13.5px] text-ink-3">Alterada {formatRelative(user.passwordChangedAt)}</span>
            </span>
          </div>
          <ChangePasswordForm />
        </section>
      </div>
    </div>
  );

  return user.role === "employee" ? (
    <EmployeeShell user={user} active="perfil">
      {content}
    </EmployeeShell>
  ) : (
    <StaffShell user={user} active="profile">
      {content}
    </StaffShell>
  );
}
