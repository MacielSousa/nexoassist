"use client";

import { ChevronLeft, ChevronRight, CircleAlert, Download, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDateTime, formatDay, shiftDay, todayBrt } from "@/lib/format";
import {
  CATEGORIES,
  HANDOFF_REASON_LABEL,
  PRIORITIES,
  STATUS_LABEL,
  type Breakdown,
  type ReportFilters,
  type ReportOverview,
  type ReportTicketsPage,
  type TicketStatus,
} from "@/lib/types";
import { cx, Dot, PRIORITY_DOT, STATUS_DOT } from "../ui";

const PAGE_SIZE = 10;

const PRESETS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function toQuery(filters: ReportFilters, extra: Record<string, string | number> = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v !== undefined && v !== "") qs.set(k, String(v));
  return qs.toString();
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Não foi possível carregar o relatório.");
  return data;
}

/** Relatórios: filtros no topo; indicadores, gráficos, desempenho por analista e lista de chamados. */
export function ReportsView({
  initialFilters,
  initialOverview,
  initialTickets,
}: {
  initialFilters: ReportFilters;
  initialOverview: ReportOverview;
  initialTickets: ReportTicketsPage;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [overview, setOverview] = useState(initialOverview);
  const [tickets, setTickets] = useState(initialTickets);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A lista de analistas do filtro vem do primeiro relatório (sem filtro de analista).
  const [analystOptions] = useState(() => initialOverview.analysts.map(({ id, name, team }) => ({ id, name, team })));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      getJson<ReportOverview>(`/api/reports/overview?${toQuery(filters)}`, controller.signal),
      getJson<ReportTicketsPage>(`/api/reports/tickets?${toQuery(filters, { page, pageSize: PAGE_SIZE })}`, controller.signal),
    ])
      .then(([o, t]) => {
        setOverview(o);
        setTickets(t);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erro ao carregar.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [filters, page]);

  const update = (patch: Partial<ReportFilters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const t = overview.tickets;
  const c = overview.conversations;
  const pages = Math.max(1, Math.ceil(tickets.total / PAGE_SIZE));

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-end gap-3 border-b border-rule px-4 py-4 sm:px-8">
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            Relatórios {loading && <LoaderCircle size={16} className="animate-spin text-ink-3" />}
          </h1>
          <p className="text-[13.5px] text-ink-3">
            {formatDay(filters.from)} a {formatDay(filters.to)} · chamados abertos no período e atendimentos
          </p>
        </div>
        <a
          href={`/api/reports/tickets.csv?${toQuery(filters)}`}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-ink/12 px-3 text-[13.5px] font-medium text-ink-2 hover:bg-desk"
        >
          <Download size={15} /> Exportar CSV
        </a>
      </header>

      <Filters filters={filters} analysts={analystOptions} onChange={update} onReset={() => update({ ...initialFilters, analystId: undefined, team: undefined, category: undefined, priority: undefined, type: undefined, status: undefined })} />

      {error && (
        <p role="alert" className="mx-4 mt-4 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text sm:mx-8">
          <CircleAlert size={14} /> {error}
        </p>
      )}

      <div className={cx("flex flex-col gap-6 px-4 py-6 transition-opacity sm:px-8", loading && "opacity-60")}>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi label="Chamados abertos" value={t.created} />
          <Kpi label="Resolvidos" value={t.resolved} />
          <Kpi label="Ainda abertos" value={t.stillOpen} />
          <Kpi label="Vencidos" value={t.overdue} tone={t.overdue > 0 ? "danger" : undefined} />
          <Kpi label="SLA cumprido" value={t.slaMetPercent === null ? "—" : `${t.slaMetPercent}%`} hint="dos resolvidos no período" />
          <Kpi label="Tempo médio de solução" value={t.avgResolutionHours === null ? "—" : `${t.avgResolutionHours} h`} />
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Conversas" value={c.total} />
          <Kpi
            label="Resolvidas pelo agent"
            value={c.resolvedByAgent}
            hint={c.total ? `${Math.round((c.resolvedByAgent / c.total) * 100)}% sem fila` : undefined}
          />
          <Kpi label="Transferidas para analista" value={c.transferred} />
          <Kpi label="Tempo médio para assumir" value={c.avgTakeoverMinutes === null ? "—" : `${c.avgTakeoverMinutes} min`} />
        </section>

        <Card title="Chamados por dia">
          <DailyChart from={filters.from} to={filters.to} data={overview.daily} />
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Por prioridade">
            <Bars data={t.byPriority} label={(k) => k} dot={(k) => PRIORITY_DOT[k as keyof typeof PRIORITY_DOT]} />
          </Card>
          <Card title="Por categoria">
            <Bars data={t.byCategory} label={(k) => k} />
          </Card>
          <Card title="Por status atual">
            <Bars data={t.byStatus} label={(k) => STATUS_LABEL[k as TicketStatus] ?? k} dot={(k) => STATUS_DOT[k as TicketStatus]} />
          </Card>
          <Card title="Motivos de transferência">
            <Bars data={c.byHandoffReason} label={(k) => HANDOFF_REASON_LABEL[k] ?? k} empty="Nenhuma transferência no período." />
          </Card>
        </div>

        <Card title="Desempenho por analista">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr>
                  <th className="py-2 pr-4 font-medium">Analista</th>
                  <th className="py-2 pr-4 font-medium">Fila</th>
                  <th className="py-2 pr-4 text-right font-medium">Conversas assumidas</th>
                  <th className="py-2 pr-4 text-right font-medium">Encerradas</th>
                  <th className="py-2 pr-4 text-right font-medium">Tempo médio p/ assumir</th>
                  <th className="py-2 text-right font-medium">Chamados resolvidos</th>
                </tr>
              </thead>
              <tbody>
                {overview.analysts.map((a) => (
                  <tr key={a.id} className="border-t border-rule">
                    <td className="py-2.5 pr-4 font-medium">{a.name}</td>
                    <td className="py-2.5 pr-4 text-ink-3">{a.team ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{a.conversationsTaken}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{a.conversationsClosed}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{a.avgTakeoverMinutes === null ? "—" : `${a.avgTakeoverMinutes} min`}</td>
                    <td className="py-2.5 text-right tabular-nums">{a.ticketsResolved}</td>
                  </tr>
                ))}
                {overview.analysts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-ink-3">
                      Nenhum analista para os filtros escolhidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title={`Chamados (${tickets.total})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13.5px]">
              <thead className="text-[12.5px] text-ink-3">
                <tr>
                  <th className="py-2 pr-4 font-medium">Chamado</th>
                  <th className="py-2 pr-4 font-medium">Título</th>
                  <th className="py-2 pr-4 font-medium">Prioridade</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Solicitante</th>
                  <th className="py-2 pr-4 font-medium">Resolvido por</th>
                  <th className="py-2 font-medium">Aberto em</th>
                </tr>
              </thead>
              <tbody>
                {tickets.rows.map((r) => (
                  <tr key={r.number} className="border-t border-rule">
                    <td className="py-2.5 pr-4 font-medium whitespace-nowrap">{r.number}</td>
                    <td className="max-w-[280px] truncate py-2.5 pr-4">{r.title}</td>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-1.5">
                        <Dot className={PRIORITY_DOT[r.priority]} /> {r.priority}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Dot className={STATUS_DOT[r.status]} /> {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">{r.requesterName}</td>
                    <td className="py-2.5 pr-4 text-ink-3">{r.resolvedByName ?? "—"}</td>
                    <td className="py-2.5 whitespace-nowrap text-ink-3">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
                {tickets.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-ink-3">
                      Nenhum chamado para os filtros escolhidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 pt-3 text-[13px] text-ink-3">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior" className="grid size-8 place-items-center rounded-lg hover:bg-desk disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              Página {page} de {pages}
              <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página" className="grid size-8 place-items-center rounded-lg hover:bg-desk disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const selectClass = "h-9 rounded-lg border border-ink/12 bg-paper px-2.5 text-[13px] outline-none focus:border-cta";

function Filters({
  filters,
  analysts,
  onChange,
  onReset,
}: {
  filters: ReportFilters;
  analysts: { id: string; name: string; team: string | null }[];
  onChange: (patch: Partial<ReportFilters>) => void;
  onReset: () => void;
}) {
  const today = todayBrt();
  const preset = PRESETS.find((p) => filters.to === today && filters.from === shiftDay(today, -(p.days - 1)));
  const opt = <T extends string>(v: string) => (v === "" ? undefined : (v as T));

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-desk/60 px-4 py-3 sm:px-8">
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => onChange({ from: shiftDay(today, -(p.days - 1)), to: today })}
            className={cx("h-9 rounded-lg px-3 text-[13px] font-medium", preset === p ? "bg-primary-soft text-primary-text" : "bg-paper text-ink-2 hover:bg-rule")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        De
        <input type="date" value={filters.from} max={filters.to} onChange={(e) => e.target.value && onChange({ from: e.target.value })} className={selectClass} />
      </label>
      <label className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        até
        <input type="date" value={filters.to} min={filters.from} max={today} onChange={(e) => e.target.value && onChange({ to: e.target.value })} className={selectClass} />
      </label>

      <select aria-label="Analista" value={filters.analystId ?? ""} onChange={(e) => onChange({ analystId: opt(e.target.value) })} className={selectClass}>
        <option value="">Todos os analistas</option>
        {analysts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.team ? ` (${a.team})` : ""}
          </option>
        ))}
      </select>
      <select aria-label="Fila" value={filters.team ?? ""} onChange={(e) => onChange({ team: opt(e.target.value) })} className={selectClass}>
        <option value="">Todas as filas</option>
        <option value="Suporte N1">Suporte N1</option>
        <option value="Suporte N2">Suporte N2</option>
      </select>
      <select aria-label="Categoria" value={filters.category ?? ""} onChange={(e) => onChange({ category: opt(e.target.value) })} className={selectClass}>
        <option value="">Todas as categorias</option>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select aria-label="Prioridade" value={filters.priority ?? ""} onChange={(e) => onChange({ priority: opt(e.target.value) })} className={selectClass}>
        <option value="">Todas as prioridades</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <select aria-label="Tipo" value={filters.type ?? ""} onChange={(e) => onChange({ type: opt(e.target.value) })} className={selectClass}>
        <option value="">INC e REQ</option>
        <option value="INC">Incidentes (INC)</option>
        <option value="REQ">Requisições (REQ)</option>
      </select>
      <select aria-label="Status" value={filters.status ?? ""} onChange={(e) => onChange({ status: opt(e.target.value) })} className={selectClass}>
        <option value="">Todos os status</option>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <button onClick={onReset} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-rule">
        <RotateCcw size={14} /> Limpar
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/9 p-4">
      <h2 className="text-[14.5px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "danger" }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-ink/9 p-4">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className={cx("font-display text-[30px] leading-none tabular-nums", tone === "danger" && "text-danger-text")}>{value}</span>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

function Bars({ data, label, dot, empty = "Sem dados no período." }: { data: Breakdown[]; label: (key: string) => string; dot?: (key: string) => string | undefined; empty?: string }) {
  if (data.length === 0) return <p className="text-[13px] text-ink-3">{empty}</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => (
        <li key={d.key} className="grid grid-cols-[140px_1fr_32px] items-center gap-3 text-[13px]">
          <span className="flex items-center gap-1.5 truncate">
            {dot?.(d.key) && <Dot className={dot(d.key)!} />}
            {label(d.key)}
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-desk">
            <span className="block h-full rounded-full bg-cta" style={{ width: `${(d.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}

/** Barras por dia: abertos (azul) e resolvidos (verde). Preenche os dias sem movimento. */
function DailyChart({ from, to, data }: { from: string; to: string; data: ReportOverview["daily"] }) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const days: { day: string; created: number; resolved: number }[] = [];
  for (let d = from; d <= to && days.length < 370; d = shiftDay(d, 1)) days.push(byDay.get(d) ?? { day: d, created: 0, resolved: 0 });
  const max = Math.max(1, ...days.map((d) => Math.max(d.created, d.resolved)));
  const labelEvery = Math.ceil(days.length / 10);

  if (!data.length) return <p className="text-[13px] text-ink-3">Nenhum chamado aberto ou resolvido no período.</p>;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label="Chamados abertos e resolvidos por dia">
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end gap-px" title={`${formatDay(d.day)}: ${d.created} abertos, ${d.resolved} resolvidos`}>
            <span className="w-1/2 rounded-t-sm bg-cta" style={{ height: `${(d.created / max) * 100}%` }} />
            <span className="w-1/2 rounded-t-sm bg-success" style={{ height: `${(d.resolved / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] text-[10.5px] text-ink-3">
        {days.map((d, i) => (
          <span key={d.day} className="flex-1 truncate text-center">
            {i % labelEvery === 0 ? formatDay(d.day) : ""}
          </span>
        ))}
      </div>
      <div className="flex gap-4 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-cta" /> Abertos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success" /> Resolvidos
        </span>
      </div>
    </div>
  );
}
