"use client";

import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";

const DEMO = [
  { email: "ana.souza@nexo.com.br", label: "Ana Souza · funcionária" },
  { email: "carla.mendes@nexo.com.br", label: "Carla Mendes · funcionária" },
  { email: "rafael.lima@nexo.com.br", label: "Rafael Lima · analista N2" },
  { email: "admin@nexo.com.br", label: "Admin" },
];

export function LoginForm({ showDemo }: { showDemo: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [email, setEmail] = useState(state.email ?? "");

  return (
    <form action={action} className="flex w-full max-w-[380px] flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[40px] leading-none">Entrar</h2>
        <p className="text-[15.5px] text-ink-3">Use seu e-mail corporativo e a senha da rede Nexo.</p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <label className="flex flex-col gap-2">
          <span className="text-[13.5px] font-medium">E-mail corporativo</span>
          <span className="flex h-11 items-center gap-2.5 rounded-lg border border-ink/12 bg-paper pr-2 pl-3.5 focus-within:border-cta">
            <Mail size={16} className="text-ink-3" />
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome.sobrenome@nexo.com.br"
              className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-ink-3/70"
            />
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="flex justify-between text-[13.5px] font-medium">
            Senha
            <span className="text-primary-text">Esqueci minha senha</span>
          </span>
          <span className="flex h-11 items-center gap-2.5 rounded-lg border border-ink/12 bg-paper pr-2 pl-3.5 focus-within:border-cta">
            <LockKeyhole size={16} className="text-ink-3" />
            <input
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              className="flex-1 bg-transparent text-[14.5px] outline-none"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Ocultar senha" : "Mostrar senha"}
              className="grid size-[30px] place-items-center rounded-md text-ink-3 hover:bg-desk"
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        <label className="flex cursor-pointer items-center gap-[9px] pt-0.5 text-[13.5px] text-ink-2">
          <input type="checkbox" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="peer sr-only" />
          <span className="grid size-[18px] place-items-center rounded-md border border-ink/20 peer-checked:border-cta peer-checked:bg-cta peer-focus-visible:outline-2 peer-focus-visible:outline-cta">
            {remember && <Check size={12} className="text-white" strokeWidth={3} />}
          </span>
          Manter conectado neste computador
        </label>
      </div>

      {state.error && (
        <p role="alert" className="-mt-3 rounded-lg bg-danger-soft px-3 py-2 text-[13.5px] text-danger-text">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 items-center justify-center gap-2 rounded-lg bg-cta text-[15.5px] font-semibold text-white hover:bg-cta-hover disabled:opacity-70"
      >
        {pending ? <LoaderCircle size={16} className="animate-spin" /> : null}
        Entrar
        {!pending && <ArrowRight size={16} />}
      </button>

      {showDemo && (
      <div className="flex flex-col gap-2 border-t border-rule pt-4 text-[12.5px] text-ink-3">
        <span>Contas de demonstração (senha do seed: nexo1234):</span>
        <div className="flex flex-wrap gap-1.5">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => setEmail(d.email)}
              className="rounded-full bg-desk px-2.5 py-1 text-ink-2 hover:bg-rule"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      )}
    </form>
  );
}
