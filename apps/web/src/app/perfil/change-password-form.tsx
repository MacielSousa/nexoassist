"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "./actions";

const input = "h-10 rounded-lg border border-ink/12 bg-paper px-3 text-[14px] outline-none focus:border-cta";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-rule bg-desk px-6 py-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-3">
          Senha atual
          <input name="currentPassword" type="password" autoComplete="current-password" required className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-3">
          Nova senha
          <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required className={input} />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] text-ink-3">
          Confirmar nova senha
          <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className={input} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="flex h-9 items-center gap-2 rounded-lg bg-cta px-4 text-[13.5px] font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
          {pending && <LoaderCircle size={14} className="animate-spin" />}
          Trocar senha
        </button>
        {state.ok && (
          <span className="flex items-center gap-1.5 text-[13px] text-success-text">
            <Check size={14} /> Senha alterada. Outras sessões foram encerradas.
          </span>
        )}
        {state.error && <span className="text-[13px] text-danger-text">{state.error}</span>}
      </div>
    </form>
  );
}
