"use client";

import { FileText, LoaderCircle, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import type { FileInfo } from "@/lib/types";
import { cx } from "../ui";

/** Tipos aceitos (a API confere de novo pelo conteúdo). */
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf,.docx,.xlsx,.pptx,.txt,.csv";
const MAX_FILES = 5;

interface Pending {
  key: string;
  name: string;
  status: "uploading" | "done" | "error";
  file?: FileInfo;
  error?: string;
}

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Envia anexos para a conversa assim que escolhidos; a mensagem depois só leva os ids. */
export function useAttachmentUploads(conversationId: string) {
  const [items, setItems] = useState<Pending[]>([]);

  const add = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_FILES - items.length;
    for (const file of [...files].slice(0, Math.max(0, room))) {
      const key = crypto.randomUUID();
      setItems((list) => [...list, { key, name: file.name, status: "uploading" }]);
      const form = new FormData();
      form.append("file", file);
      fetch(`/api/conversations/${conversationId}/attachments`, { method: "POST", body: form })
        .then(async (res) => {
          const data = (await res.json().catch(() => ({}))) as FileInfo & { message?: string };
          if (!res.ok) throw new Error(data.message ?? "Falha no envio.");
          setItems((list) => list.map((i) => (i.key === key ? { ...i, status: "done", file: data } : i)));
        })
        .catch((err: unknown) => {
          setItems((list) => list.map((i) => (i.key === key ? { ...i, status: "error", error: err instanceof Error ? err.message : "Falha no envio." } : i)));
        });
    }
  };

  return {
    items,
    add,
    remove: (key: string) => setItems((list) => list.filter((i) => i.key !== key)),
    clear: () => setItems([]),
    ids: items.filter((i) => i.status === "done").map((i) => i.file!.id),
    uploading: items.some((i) => i.status === "uploading"),
    full: items.length >= MAX_FILES,
  };
}

export function AttachButton({ onPick, disabled }: { onPick: (files: FileList | null) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-label="Anexar arquivo"
        title="Anexar imagem, vídeo ou documento"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-desk hover:text-ink-2 disabled:opacity-40"
      >
        <Paperclip size={17} />
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

/** Anexos escolhidos, ainda não enviados na mensagem. */
export function PendingAttachments({ items, onRemove }: { items: Pending[]; onRemove: (key: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pb-2">
      {items.map((i) => (
        <span
          key={i.key}
          title={i.error}
          className={cx(
            "flex max-w-[260px] items-center gap-1.5 rounded-lg border px-2 py-1 text-[12.5px]",
            i.status === "error" ? "border-danger/30 bg-danger-soft text-danger-text" : "border-rule bg-desk text-ink-2",
          )}
        >
          {i.status === "uploading" ? <LoaderCircle size={13} className="animate-spin" /> : <Paperclip size={13} />}
          <span className="truncate">{i.status === "error" ? `${i.name}: ${i.error}` : i.name}</span>
          <button type="button" onClick={() => onRemove(i.key)} aria-label={`Remover ${i.name}`} className="rounded hover:bg-rule">
            <X size={13} />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Anexos dentro de uma mensagem: imagem em miniatura, vídeo com player e documento para baixar. */
export function MessageAttachments({ files }: { files: FileInfo[] }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) =>
        f.kind === "image" ? (
          <a key={f.id} href={`/api${f.url}`} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-rule">
            {/* eslint-disable-next-line @next/next/no-img-element -- arquivo privado servido pelo proxy autenticado */}
            <img src={`/api${f.url}`} alt={f.name} className="max-h-48 max-w-[260px] object-cover" />
          </a>
        ) : f.kind === "video" ? (
          <video key={f.id} src={`/api${f.url}`} controls preload="metadata" className="max-h-60 max-w-[320px] rounded-lg border border-rule bg-ink" />
        ) : (
          <a
            key={f.id}
            href={`/api${f.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex max-w-[280px] items-center gap-2 rounded-lg border border-rule bg-paper px-3 py-2 text-[13px] hover:bg-desk"
          >
            <FileText size={18} className="shrink-0 text-ink-3" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ink">{f.name}</span>
              <span className="text-[11.5px] text-ink-3">{formatSize(f.size)}</span>
            </span>
          </a>
        ),
      )}
    </div>
  );
}
