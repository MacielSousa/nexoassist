// Horário do service desk: segunda a sexta, 8h às 18h (horário de Brasília).
// O Brasil não tem horário de verão desde 2019, então um offset fixo de -03:00 basta.
// Feriados ficam fora do escopo (ver README).

const OFFSET_MS = -3 * 60 * 60 * 1000;
const OPEN_HOUR = 8;
const CLOSE_HOUR = 18;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "Relógio de parede" em Brasília, representado num Date cujos getters UTC são a hora local. */
function toLocal(date: Date): Date {
  return new Date(date.getTime() + OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - OFFSET_MS);
}

function isWeekday(local: Date): boolean {
  const d = local.getUTCDay();
  return d !== 0 && d !== 6;
}

function atHour(local: Date, hour: number): Date {
  const d = new Date(local);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/** Avança para o próximo instante dentro do expediente (ou mantém, se já estiver dentro). */
function nextBusinessInstant(local: Date): Date {
  let d = new Date(local);
  for (;;) {
    if (isWeekday(d)) {
      const hour = d.getUTCHours() + d.getUTCMinutes() / 60;
      if (hour < OPEN_HOUR) return atHour(d, OPEN_HOUR);
      if (hour < CLOSE_HOUR) return d;
    }
    d = atHour(new Date(d.getTime() + DAY), OPEN_HOUR);
  }
}

export function isBusinessTime(date: Date): boolean {
  const local = toLocal(date);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60;
  return isWeekday(local) && hour >= OPEN_HOUR && hour < CLOSE_HOUR;
}

export function addBusinessHours(start: Date, hours: number): Date {
  let local = nextBusinessInstant(toLocal(start));
  let remaining = hours * HOUR;
  while (remaining > 0) {
    const close = atHour(local, CLOSE_HOUR);
    const available = close.getTime() - local.getTime();
    if (remaining <= available) {
      local = new Date(local.getTime() + remaining);
      remaining = 0;
    } else {
      remaining -= available;
      local = nextBusinessInstant(close);
    }
  }
  return fromLocal(local);
}

export function addBusinessDays(start: Date, days: number): Date {
  // Um "dia útil" equivale a um expediente completo (10 h úteis).
  return addBusinessHours(start, days * (CLOSE_HOUR - OPEN_HOUR));
}

/** Horas úteis decorridas entre dois instantes. */
export function businessHoursBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let local = nextBusinessInstant(toLocal(from));
  const end = toLocal(to);
  let total = 0;
  while (local < end) {
    const close = atHour(local, CLOSE_HOUR);
    const segmentEnd = close < end ? close : end;
    total += Math.max(0, segmentEnd.getTime() - local.getTime());
    local = nextBusinessInstant(close);
  }
  return total / HOUR;
}
