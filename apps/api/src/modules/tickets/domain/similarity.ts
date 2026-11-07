import { canReopen, isOpen, type Category, type TicketStatus } from "./ticketRules";

// Detecção de duplicidade: "se já existe um chamado aberto sobre o mesmo problema, ele é atualizado".
// Heurística léxica simples e explicável; o agent mostra os candidatos e decide com o funcionário.

const STOPWORDS = new Set(
  "a o as os um uma uns umas de da do das dos em no na nos nas para por com sem que e ou se meu minha meus minhas seu sua nao esta estou desde ontem hoje ao aos foi ser ter tem tenho preciso mais muito quando como".split(" "),
);

/** Minúsculas, sem acento, sem pontuação e sem palavras vazias. */
export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/** Coeficiente de sobreposição: tolera um texto bem mais longo que o outro. */
export function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a));
  const tb = new Set(normalize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.min(ta.size, tb.size);
}

export interface DuplicateCandidate {
  number: string;
  title: string;
  status: TicketStatus;
  score: number;
  action: "atualizar" | "reabrir";
}

interface ComparableTicket {
  number: string;
  title: string;
  description: string;
  category: Category;
  status: TicketStatus;
  resolvedAt: Date | null;
}

export function findDuplicates(
  draft: { category: Category; title: string; description: string },
  tickets: ComparableTicket[],
  now = new Date(),
  threshold = 0.34,
): DuplicateCandidate[] {
  const draftText = `${draft.title} ${draft.description}`;
  return tickets
    .filter((t) => isOpen(t.status) || canReopen(t, now))
    .map((t) => {
      const score = similarity(draftText, `${t.title} ${t.description}`) + (t.category === draft.category ? 0.15 : 0);
      return {
        number: t.number,
        title: t.title,
        status: t.status,
        score: Math.min(1, Math.round(score * 100) / 100),
        action: isOpen(t.status) ? ("atualizar" as const) : ("reabrir" as const),
      };
    })
    .filter((c) => c.score >= threshold)
    .sort((a, b) => b.score - a.score);
}
