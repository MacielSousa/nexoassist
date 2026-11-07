import { KeyRound, Lock } from "lucide-react";
import { EmployeeShell } from "@/components/employee-shell";
import { formatRelative } from "@/lib/format";
import { requireUser } from "@/lib/api";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser("employee");
  return (
    <EmployeeShell user={user} active="perfil">
      <div className="flex-1 overflow-y-auto px-4 py-12 sm:px-10">
        <div className="flex max-w-[600px] flex-col gap-8">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">Meu perfil</h1>
            <p className="text-[14.5px] text-ink-3">Seus dados de acesso ao service desk de TI.</p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-ink/9">
            <Row label="Nome">{user.name}</Row>
            <Row label="Área">{user.department}</Row>
            <Row label="E-mail corporativo" last>
              <span className="flex flex-1 flex-wrap items-center justify-between gap-2">
                {user.email}
                <span className="flex items-center gap-[5px] text-[12.5px] font-normal text-ink-3">
                  <Lock size={13} /> Gerenciado pela TI
                </span>
              </span>
            </Row>
          </section>

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
    </EmployeeShell>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 px-6 py-5 sm:flex-row sm:items-center sm:gap-4 ${last ? "" : "border-b border-rule"}`}>
      <span className="w-40 shrink-0 text-[13.5px] text-ink-3">{label}</span>
      <span className="flex flex-1 text-[14.5px] font-medium">{children}</span>
    </div>
  );
}
