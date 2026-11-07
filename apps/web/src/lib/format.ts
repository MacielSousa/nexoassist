const TZ = "America/Sao_Paulo";

export function formatRelative(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? "há 1 dia" : `há ${d} dias`;
  const w = Math.round(d / 7);
  return w === 1 ? "há 1 semana" : `há ${w} semanas`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(iso))
    .replace(".", "");
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" })
    .format(new Date(iso))
    .replace(".", "")
    .replace(" de ", " ");
}

/** Hora se for hoje; senão, data e hora. */
export function formatWhen(iso: string, now: Date = new Date()): string {
  const sameDay = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short" });
  return sameDay.format(new Date(iso)) === sameDay.format(now) ? formatTime(iso) : formatDateTime(iso);
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Hoje em Brasília no formato AAAA-MM-DD (o que os filtros de data usam). */
export function todayBrt(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Soma dias a uma data AAAA-MM-DD. */
export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-07" → "07 nov". */
export function formatDay(day: string): string {
  return formatDate(`${day}T12:00:00-03:00`);
}
