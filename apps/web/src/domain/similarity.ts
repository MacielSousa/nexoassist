import { canReopen } from "./sla";
import { isOpen, type Category, type Ticket } from "./types";

// Detecção de duplicidade: "se já existe um chamado aberto sobre o mesmo problema, ele é atualizado".
// Heurística léxica simples e explicável; o agent recebe os candidatos com a pontuação e decide com o funcionário.

const STOPWORDS = new Set(
  "a o as os um uma uns umas de da do das dos em no na nos nas para por com sem que e ou se meu minha meus minhas seu sua nao não esta está estou desde ontem hoje ao aos é foi ser ter tem tenho preciso mais muito quando como".split(
    " ",
  ),
);

export function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a));
  const tb = new Set(normalize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  // Coeficiente de sobreposição: tolera um texto bem mais longo que o outro.
  return inter / Math.min(ta.size, tb.size);
}

export interface DuplicateCandidate {
  number: string;
  title: string;
  status: Ticket["status"];
  score: number;
  action: "atualizar" | "reabrir";
}

export function findDuplicates(
  draft: { category: Category; title: string; description: string },
  tickets: Ticket[],
  now: Date = new Date(),
  threshold = 0.34,
): DuplicateCandidate[] {
  const draftText = `${draft.title} ${draft.description}`;
  return tickets
    .filter((t) => isOpen(t.status) || canReopen(t, now))
    .map((t) => {
      let score = similarity(draftText, `${t.title} ${t.description}`);
      if (t.category === draft.category) score += 0.15;
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
