// Wrapper minimalista alrededor de rrule.js para nuestros casos de uso.
import { RRule, RRuleSet } from "rrule";

type CalcArgs = {
  rrule: string | null;            // null = no recurrente
  fecha_inicio: string;            // "YYYY-MM-DD"
  fecha_fin?: string | null;       // "YYYY-MM-DD" | null
  hora: string;                    // "HH:MM:SS" o "HH:MM"
  timezone?: string;               // ignorado en el cálculo simple (asumimos hora local del servidor)
  from?: Date;                     // desde cuándo buscar (default: now)
};

/** Próxima ocurrencia ≥ `from` o null si ya no hay más. */
export function nextOccurrence({ rrule, fecha_inicio, fecha_fin, hora, from }: CalcArgs): Date | null {
  const [h, m, s] = (hora.length === 5 ? hora + ":00" : hora).split(":").map(Number);
  const start = new Date(`${fecha_inicio}T${pad(h)}:${pad(m)}:${pad(s ?? 0)}`);
  const until = fecha_fin ? new Date(`${fecha_fin}T23:59:59`) : null;
  const after = from ?? new Date();

  if (!rrule) {
    // Una sola vez. Si ya pasó, devuelve null.
    return start.getTime() >= after.getTime() ? start : null;
  }

  const opts = RRule.parseString(rrule);
  opts.dtstart = start;
  if (until) opts.until = until;

  const rule = new RRule(opts);
  // `after` no inclusivo si pasamos true como segundo arg = inclusivo.
  const next = rule.after(after, true);
  return next ?? null;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
