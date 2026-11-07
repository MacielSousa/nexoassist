"use client";

import { ArrowRightLeft, ChevronDown, ChevronRight, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { TicketView } from "@/agent/types";
import { formatDate, formatRelative, formatTime, isOpen } from "@/domain";
import type { PublicUser } from "@/server/types";
import { cx, Dot, STATUS_DOT } from "../ui";

type HistoryTicket = TicketView & { resolvedAt: string | null; lastComment: { at: string; author: string; text: string } | null };

/** Painel lateral com os chamados do funcionário (direto do serviço de chamados). */
export function TicketHistory({ employee, focusTicket, refreshKey }: { employee: PublicUser; focusTicket: string | null; refreshKey: string }) {
  const [tickets, setTickets] = useState<HistoryTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const first = employee.name.split(" ")[0];

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(`/api/console/employees/${encodeURIComponent(employee.id)}/tickets`, { cache: "no-store" });
        const data = (await res.json()) as { tickets?: HistoryTicket[]; error?: string };
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error);
        setTickets(data.tickets ?? []);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error && err.message ? err.message : "Sistema de chamados indisponível.");
        retry = setTimeout(load, 3000); // o legado costuma voltar em segundos
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [employee.id, refreshKey]);

  const current = tickets?.find((t) => t.number === focusTicket) ?? null;
  const others = (tickets ?? []).filter((t) => t !== current);
  const openCount = tickets?.filter((t) => isOpen(t.status)).length ?? 0;
  const visibleOthers = showAll ? others : others.slice(0, 4);

  return (
    <aside className="hidden w-[340px] shrink-0 flex-col border-l border-rule bg-paper xl:flex">
      <header className="flex h-16 shrink-0 flex-col justify-center gap-0.5 border-b border-rule px-5">
        <span className="text-[15.5px] font-semibold">Chamados de {first}</span>
        <span className="text-[12.5px] text-ink-3">
          {tickets ? `${openCount} abertos · ${tickets.length - openCount} encerrados` : "carregando…"}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-5 pt-6 pb-5">
        {error && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[12.5px] text-warning-text">{error}</p>}
        {!tickets && !error && <LoaderCircle size={18} className="animate-spin self-center text-ink-3" />}

        {current && (
          <section className="flex flex-col gap-3">
            <span className="text-[12.5px] font-semibold text-ink-3">Desta conversa</span>
            <div className="flex flex-col gap-3.5 rounded-xl bg-desk p-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center">
                  <span className="flex-1 text-[12.5px] font-medium text-ink-3">{current.number}</span>
                  <span className={cx("flex items-center gap-1.5 text-[12.5px] font-semibold", current.status === "em_andamento" ? "text-primary-text" : "text-warning-text")}>
                    <Dot className={STATUS_DOT[current.status]} size={7} />
                    {current.statusLabel}
                  </span>
                </div>
                <span className="text-[15.5px] font-semibold">{current.title}</span>
                <span className="text-[13.5px] text-ink-3">
                  {current.category} · prioridade {current.priority.toLowerCase()}
                  {current.overdue && " · prazo vencido"}
                </span>
              </div>
              {current.lastComment && (
                <div className="flex items-start gap-2 border-t border-rule pt-3 text-[13.5px]">
                  <ArrowRightLeft size={15} className="mt-0.5 shrink-0 text-ink-3" />
                  <span className="flex-1 text-ink-2">{current.lastComment.text}</span>
                  <span className="text-[12.5px] text-ink-3">{formatTime(current.lastComment.at)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {tickets && (
          <section className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink-3">{current ? "Outros chamados" : "Chamados"}</span>
            {others.length === 0 && <span className="py-3 text-[13.5px] text-ink-3">Nenhum outro chamado.</span>}
            {visibleOthers.map((t, i) => (
              <details key={t.number} className={cx("group", i < visibleOthers.length - 1 && "border-b border-rule")}>
                <summary className="flex cursor-pointer list-none items-center gap-3 py-3">
                  <Dot className={STATUS_DOT[t.status]} size={7} />
                  <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                    <span className="truncate text-[14.5px] font-medium">{t.title}</span>
                    <span className="text-[12.5px] text-ink-3">
                      {t.number} · {isOpen(t.status) ? t.statusLabel : `${t.statusLabel} em ${formatDate(t.resolvedAt ?? t.updatedAt)}`}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-ink-3 transition-transform group-open:rotate-90" />
                </summary>
                <div className="flex flex-col gap-1 pb-3 pl-5 text-[13px] text-ink-2">
                  <span>{t.description}</span>
                  <span className="text-[12px] text-ink-3">
                    {t.category} · {t.priority} · atualizado {formatRelative(t.updatedAt)}
                    {t.overdue && " · prazo vencido"}
                  </span>
                </div>
              </details>
            ))}
          </section>
        )}
      </div>

      {others.length > 4 && (
        <footer className="border-t border-rule px-4 pt-3 pb-4">
          <button
            onClick={() => setShowAll((s) => !s)}
            className="flex h-9 w-full items-center justify-center gap-[7px] rounded-lg border border-ink/12 text-[13.5px] font-medium text-ink-2 hover:bg-desk"
          >
            {showAll ? "Mostrar menos" : `Ver todos os chamados de ${first}`}
            <ChevronDown size={14} className={cx("transition-transform", showAll && "rotate-180")} />
          </button>
        </footer>
      )}
    </aside>
  );
}
