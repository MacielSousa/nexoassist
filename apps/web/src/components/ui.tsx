import type { Priority, TicketStatus } from "@/domain";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export const STATUS_DOT: Record<TicketStatus, string> = {
  aberto: "bg-primary",
  em_andamento: "bg-primary",
  aguardando_analista: "bg-warning",
  aguardando_funcionario: "bg-warning",
  aprovado: "bg-success",
  resolvido: "bg-ink/25",
  fechado: "bg-ink/25",
};

export const PRIORITY_DOT: Record<Priority, string> = {
  Crítica: "bg-danger",
  Alta: "bg-warning",
  Média: "bg-ink/40",
  Baixa: "bg-ink/20",
};

export function Dot({ className, size = 6 }: { className: string; size?: number }) {
  return <span className={cx("inline-block shrink-0 rounded-full", className)} style={{ width: size, height: size }} />;
}

export function Avatar({
  initials,
  bg,
  fg,
  size = 34,
  online,
  ring = "var(--color-paper)",
}: {
  initials: string;
  bg: string;
  fg: string;
  size?: number;
  online?: boolean;
  ring?: string;
}) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size > 40 ? 15.5 : size > 36 ? 14.5 : 12.5 }}
    >
      {initials}
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full bg-success"
          style={{ width: size > 40 ? 11 : 10, height: size > 40 ? 11 : 10, boxShadow: `0 0 0 2px ${ring}` }}
        />
      )}
    </span>
  );
}

export function Pill({ tone, children }: { tone: "success" | "warning" | "primary" | "danger" | "neutral"; children: React.ReactNode }) {
  const tones = {
    success: "bg-success-soft text-success-text",
    warning: "bg-warning-soft text-warning-text",
    primary: "bg-primary-soft text-primary-text",
    danger: "bg-danger-soft text-danger-text",
    neutral: "bg-desk text-ink-2",
  };
  const dots = { success: "bg-success", warning: "bg-warning", primary: "bg-cta", danger: "bg-danger", neutral: "bg-ink/30" };
  return (
    <span className={cx("inline-flex items-center gap-[7px] rounded-full px-2.5 py-[5px] text-[12.5px] font-semibold", tones[tone])}>
      <Dot className={dots[tone]} size={7} />
      {children}
    </span>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="digitando">
      <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
      <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
      <span className="typing-dot size-1.5 rounded-full bg-ink-3" />
    </span>
  );
}
