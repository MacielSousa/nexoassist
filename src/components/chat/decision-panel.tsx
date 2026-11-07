"use client";

import { ChevronRight, CircleCheck, CircleX } from "lucide-react";
import { useState } from "react";
import type { TurnTrace } from "@/agent/types";
import { cx } from "../ui";

/** Transparência: o que o agent entendeu, o que fez, com que segurança e a que custo. */
export function DecisionPanel({ trace }: { trace: TurnTrace }) {
  const [open, setOpen] = useState(false);
  const confidence = trace.decision ? Math.round(trace.decision.confidence * 100) : null;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-fit items-center gap-1 text-[12.5px] text-ink-3 hover:text-ink-2"
      >
        <ChevronRight size={13} className={cx("transition-transform", open && "rotate-90")} />
        Como decidi
        {confidence !== null && <span className="text-ink-3/80">· confiança {confidence}%</span>}
      </button>

      {open && (
        <div className="flex w-full max-w-[680px] flex-col gap-3 rounded-xl border border-rule bg-desk p-4 text-[13px]">
          {trace.decision && (
            <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2">
              <dt className="text-ink-3">Entendi</dt>
              <dd className="font-medium">{trace.decision.intent}</dd>
              <dt className="text-ink-3">Confiança</dt>
              <dd className="flex items-center gap-2">
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-rule">
                  <span
                    className={cx("block h-full rounded-full", confidence! >= 70 ? "bg-success" : confidence! >= 50 ? "bg-warning" : "bg-danger")}
                    style={{ width: `${confidence}%` }}
                  />
                </span>
                {confidence}%
              </dd>
              <dt className="text-ink-3">Por quê</dt>
              <dd className="text-ink-2">{trace.decision.rationale}</dd>
            </dl>
          )}

          {trace.tools.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-ink-3">Ações</span>
              {trace.tools.map((t, i) => (
                <details key={i} className="group rounded-lg bg-paper px-3 py-2">
                  <summary className="flex cursor-pointer list-none items-center gap-2">
                    {t.ok ? <CircleCheck size={14} className="text-success-text" /> : <CircleX size={14} className="text-danger-text" />}
                    <span className="flex-1">{t.label}</span>
                    <code className="text-[11.5px] text-ink-3">{t.tool}</code>
                    <span className="w-14 text-right text-[11.5px] text-ink-3">{t.ms} ms</span>
                    <ChevronRight size={13} className="text-ink-3 transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Json label="Entrada" value={t.input} />
                    <Json label="Resultado" value={t.output} />
                  </div>
                </details>
              ))}
            </div>
          )}

          {trace.error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-danger-text">Erro: {trace.error}</p>}

          <p className="text-[11.5px] text-ink-3">
            {[trace.model, `${trace.usage.inputTokens} tokens de entrada`, `${trace.usage.outputTokens} de saída`, `${(trace.latencyMs / 1000).toFixed(1)} s`]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <span className="text-[11.5px] text-ink-3">{label}</span>
      <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-desk p-2 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
