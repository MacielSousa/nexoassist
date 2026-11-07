"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { User } from "@/lib/types";
import { Avatar, avatarColors } from "../ui";

/**
 * Foto de perfil com trocar/remover. `endpoint` é /api/users/me/avatar (o próprio usuário)
 * ou /api/users/<id>/avatar (admin editando outra pessoa).
 */
export function AvatarEditor({ user, endpoint, onChange, size = 72 }: { user: User; endpoint: string; onChange: (user: User) => void; size?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, init);
      const data = (await res.json().catch(() => ({}))) as User & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Não foi possível atualizar a foto.");
      onChange(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  };

  const upload = (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    void call({ method: "PUT", body: form });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar initials={user.initials} {...avatarColors(user.name)} src={user.avatarUrl} size={size} />
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink/40 text-white">
            <LoaderCircle size={18} className="animate-spin" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-ink/12 px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-desk"
          >
            <Camera size={14} /> {user.avatarUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={() => void call({ method: "DELETE" })}
              disabled={busy}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-danger-text hover:bg-danger-soft"
            >
              <Trash2 size={14} /> Remover
            </button>
          )}
        </div>
        <span className="text-[12px] text-ink-3">JPG, PNG, WEBP ou GIF, até 5 MB.</span>
        {error && <span className="text-[12px] text-danger-text">{error}</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
