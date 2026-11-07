"use server";

import { ApiError, apiFetch } from "@/lib/api";

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

export async function changePassword(_prev: ChangePasswordState, form: FormData): Promise<ChangePasswordState> {
  const currentPassword = String(form.get("currentPassword") ?? "");
  const newPassword = String(form.get("newPassword") ?? "");
  if (newPassword !== String(form.get("confirmPassword") ?? "")) return { error: "A confirmação não confere com a nova senha." };
  try {
    await apiFetch("/users/me/password", { method: "PATCH", body: JSON.stringify({ currentPassword, newPassword }) });
    return { ok: true };
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : "Não foi possível trocar a senha." };
  }
}
