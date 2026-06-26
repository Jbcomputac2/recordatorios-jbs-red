// Tipos compartidos cliente/servidor.

export type Categoria = {
  id: number;
  nombre: string;
  emoji: string;
  color: string;
  sonido: string | null;
  orden: number;
};

export type Accion =
  | { label: string; kind: "done" }
  | { label: string; kind: "snooze"; minutes: number }
  | { label: string; kind: "open"; url: string };

export type Item = {
  id: number;
  categoria_id: number | null;
  titulo: string;
  descripcion: string | null;
  hora: string;          // "HH:MM:SS"
  rrule: string | null;  // null = una sola vez
  fecha_inicio: string;  // "YYYY-MM-DD"
  fecha_fin: string | null;
  next_at: string | null; // ISO
  activo: boolean;
  prioridad: number;     // 1..5
  sonido: string | null;
  click_url: string | null;
  acciones: Accion[];
  /** Si no es null, se repite cada X min hasta que el usuario toque "Hecho". */
  repetir_cada_min: number | null;
  timezone: string;
  date_created: string;
  date_updated: string;
  last_sent_at: string | null;
  last_done_at: string | null;
};

export type Settings = {
  user_id: string;
  ntfy_topic: string;
  ntfy_url: string;
  webhook_secret: string;
  quiet_start: string | null;
  quiet_end: string | null;
  quiet_carry: boolean;
  timezone: string;
};

export const DEFAULT_ACCIONES: Accion[] = [
  { label: "✓ Hecho", kind: "done" },
  { label: "+10 min", kind: "snooze", minutes: 10 },
  { label: "+1 hora", kind: "snooze", minutes: 60 },
];

// Presets de recurrencia (UI). El valor es un RRULE válido o null para "una vez".
export const RECURRENCE_PRESETS = [
  { id: "once",      label: "Una vez",   rrule: null },
  { id: "daily",     label: "Diario",    rrule: "FREQ=DAILY" },
  { id: "weekdays",  label: "Lun–Vie",   rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { id: "weekly",    label: "Semanal",   rrule: "FREQ=WEEKLY" },
  { id: "monthly",   label: "Mensual",   rrule: "FREQ=MONTHLY" },
  { id: "yearly",    label: "Anual",     rrule: "FREQ=YEARLY" },
] as const;

export const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"] as const;
export const DAY_CODES  = ["MO","TU","WE","TH","FR","SA","SU"] as const;

export function rruleHumanLabel(rrule: string | null, days?: string): string {
  if (!rrule) return "Una vez";
  if (rrule === "FREQ=DAILY") return "Diario";
  if (rrule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "Lun–Vie";
  if (/FREQ=WEEKLY;BYDAY=/.test(rrule)) {
    const m = rrule.match(/BYDAY=([A-Z,]+)/);
    if (m) {
      const codes = m[1].split(",");
      const map: Record<string,string> = { MO:"Lun", TU:"Mar", WE:"Mié", TH:"Jue", FR:"Vie", SA:"Sáb", SU:"Dom" };
      return codes.map(c => map[c] ?? c).join(" · ");
    }
  }
  if (rrule.startsWith("FREQ=WEEKLY")) return "Semanal";
  if (rrule.startsWith("FREQ=MONTHLY")) return "Mensual";
  if (rrule.startsWith("FREQ=YEARLY")) return "Anual";
  return rrule;
}
