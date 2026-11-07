"use server";

import { redirect } from "next/navigation";
import { endSession, findUser, startSession } from "@/server/auth";

export interface LoginState {
  error?: string;
  email?: string;
}

// Protótipo: aceita qualquer senha para os funcionários dos dados de exemplo (PRD, tela 1).
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!/^[^@\s]+@nexo\.com\.br$/.test(email)) return { error: "Use seu e-mail corporativo (@nexo.com.br).", email };
  if (!password) return { error: "Informe a senha.", email };
  const user = findUser(email);
  if (!user) return { error: "Não encontramos esse e-mail. Confira ou use uma das contas de demonstração.", email };
  await startSession(user.id, form.get("remember") === "on");
  redirect(user.role === "analyst" ? "/console" : "/chat");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
