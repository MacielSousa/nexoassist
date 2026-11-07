"use client";

import { Check, LoaderCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@/lib/types";
import { AvatarEditor } from "./avatar-editor";

const input = "h-10 w-full rounded-lg border border-ink/12 bg-paper px-3 text-[14px] outline-none focus:border-cta";

/** Edição do próprio perfil. Trocar o e-mail (login) pede a senha atual. */
export function ProfileForm({ initial }: { initial: User }) {
  const router = useRouter();
  const [user, setUser] = useState(initial);
  const [form, setForm] = useState({ name: initial.name, department: initial.department, email: initial.email, currentPassword: "" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});

  const emailChanged = form.email.trim().toLowerCase() !== user.email;
  const dirty = form.name !== user.name || form.department !== user.department || emailChanged;

  const save = async () => {
    setSaving(true);
    setStatus({});
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          department: form.department,
          ...(emailChanged ? { email: form.email, currentPassword: form.currentPassword } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as User & { message?: string; issues?: { message: string }[] };
      if (!res.ok) throw new Error(data.issues?.[0]?.message ?? data.message ?? "Não foi possível salvar.");
      setUser(data);
      setForm({ name: data.name, department: data.department, email: data.email, currentPassword: "" });
      setStatus({ ok: emailChanged ? "Perfil salvo. Seu e-mail de login mudou; as outras sessões foram encerradas." : "Perfil salvo." });
      router.refresh();
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : "Algo deu errado." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-ink/9 p-6">
      <AvatarEditor
        user={user}
        endpoint="/api/users/me/avatar"
        onChange={(u) => {
          setUser(u);
          router.refresh();
        }}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Nome
          <input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Área
          <input required minLength={2} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
          E-mail corporativo (login)
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
        </label>
        {emailChanged && (
          <label className="flex flex-col gap-1.5 text-[13px] font-medium sm:col-span-2">
            <span className="flex items-center gap-1.5">
              <Lock size={13} /> Confirme com a sua senha atual para trocar o e-mail
            </span>
            <input required type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} className={input} />
          </label>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button disabled={!dirty || saving} className="flex h-9 items-center gap-2 rounded-lg bg-cta px-4 text-[13.5px] font-semibold text-white hover:bg-cta-hover disabled:opacity-50">
            {saving && <LoaderCircle size={14} className="animate-spin" />}
            Salvar alterações
          </button>
          {status.ok && (
            <span className="flex items-center gap-1.5 text-[13px] text-success-text">
              <Check size={14} /> {status.ok}
            </span>
          )}
          {status.error && <span className="text-[13px] text-danger-text">{status.error}</span>}
        </div>
      </form>
    </section>
  );
}
