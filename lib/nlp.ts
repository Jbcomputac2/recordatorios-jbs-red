// Parser muy ligero de lenguaje natural (español) para crear recordatorios.
// Reconoce: hora ("7am", "07:00", "5pm", "a las 5"), día relativo ("hoy", "mañana",
// "el lunes"), y recurrencia ("diario", "cada día", "cada lunes", "lun mié vie").
// Devuelve {titulo, fecha_inicio, hora, rrule}.

export type Parsed = {
  titulo: string;
  fecha_inicio: string;  // YYYY-MM-DD
  hora: string;          // HH:MM
  rrule: string | null;
};

const DOW: Record<string, number> = {
  domingo: 0, dom: 0,
  lunes: 1, lun: 1,
  martes: 2, mar: 2,
  miercoles: 3, "miércoles": 3, mie: 3, "mié": 3,
  jueves: 4, jue: 4,
  viernes: 5, vie: 5,
  sabado: 6, "sábado": 6, sab: 6, "sáb": 6,
};
const DOW_CODE = ["SU","MO","TU","WE","TH","FR","SA"];

export function parseEs(text: string, now: Date = new Date()): Parsed {
  const raw = text;
  let s = " " + text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
  const matchedRanges: Array<[number, number]> = [];
  // ojo: hacemos los matches contra la versión sin acentos pero registramos rangos sobre `text` original
  // por simplicidad eliminaremos del título los tokens reconocidos por substring (case-insensitive).
  const tokensToStrip: string[] = [];

  // hora
  let hora = "09:00";
  const horaMatchers = [
    /\ba las (\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/,
    /\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/,
    /\b(\d{1,2})\s*(am|pm)\b/,
  ];
  for (const re of horaMatchers) {
    const m = s.match(re);
    if (m) {
      let h = parseInt(m[1]);
      const mm = parseInt(m[2] || "0");
      const ap = (m[3] || "").toLowerCase();
      if (ap === "pm" && h < 12) h += 12;
      if (ap === "am" && h === 12) h = 0;
      hora = `${pad(h)}:${pad(mm)}`;
      tokensToStrip.push(m[0].trim());
      break;
    }
  }

  // recurrencia explícita
  let rrule: string | null = null;
  if (/\b(diario|cada dia|todos los dias)\b/.test(s)) {
    rrule = "FREQ=DAILY";
    tokensToStrip.push("diario", "cada dia", "todos los dias", "cada día", "todos los días");
  } else if (/\b(entre semana|lun a vie|lunes a viernes)\b/.test(s)) {
    rrule = "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    tokensToStrip.push("entre semana", "lun a vie", "lunes a viernes");
  } else if (/\b(semanal|cada semana)\b/.test(s)) {
    rrule = "FREQ=WEEKLY";
    tokensToStrip.push("semanal", "cada semana");
  } else if (/\b(mensual|cada mes)\b/.test(s)) {
    rrule = "FREQ=MONTHLY";
    tokensToStrip.push("mensual", "cada mes");
  } else {
    // "cada lunes" / "los lunes" / "lun mie vie"
    const days: number[] = [];
    for (const [name, dow] of Object.entries(DOW)) {
      const re = new RegExp(`\\b(cada |los )?${name}s?\\b`, "g");
      if (re.test(s)) days.push(dow);
    }
    const isRecurring = /\b(cada|los)\b/.test(s);
    if (isRecurring && days.length > 0) {
      const codes = days.map((d) => DOW_CODE[d]).join(",");
      rrule = `FREQ=WEEKLY;BYDAY=${codes}`;
      tokensToStrip.push("cada", "los");
    }
  }

  // fecha (relativa o día de la semana sin "cada")
  const today = startOfDay(now);
  let fechaInicio = today;
  if (/\bmanana\b/.test(s) || /\bmañana\b/.test(text.toLowerCase())) {
    fechaInicio = addDays(today, 1);
    tokensToStrip.push("manana", "mañana");
  } else if (/\bpasado manana\b/.test(s) || /\bpasado mañana\b/.test(text.toLowerCase())) {
    fechaInicio = addDays(today, 2);
    tokensToStrip.push("pasado manana", "pasado mañana");
  } else if (/\bhoy\b/.test(s)) {
    fechaInicio = today;
    tokensToStrip.push("hoy");
  } else if (/\besta noche\b/.test(s)) {
    fechaInicio = today;
    hora = hora === "09:00" ? "21:00" : hora;
    tokensToStrip.push("esta noche");
  } else if (!rrule) {
    // "el lunes" → próximo lunes
    for (const [name, dow] of Object.entries(DOW)) {
      const re = new RegExp(`\\b(el |proximo |próximo )?${name}\\b`);
      if (re.test(s)) {
        const today_dow = today.getDay();
        const delta = ((dow - today_dow) + 7) % 7 || 7;
        fechaInicio = addDays(today, delta);
        tokensToStrip.push("el", "proximo", "próximo", name);
        break;
      }
    }
  }

  // strip tokens del título
  let titulo = raw;
  for (const t of tokensToStrip) {
    if (!t) continue;
    titulo = titulo.replace(new RegExp(escapeRe(t), "ig"), " ");
  }
  // limpia preposiciones huérfanas comunes
  titulo = titulo.replace(/\b(a las|las|a|el|los|de|por|para)\b/gi, " ");
  titulo = titulo.replace(/\s+/g, " ").trim();
  if (!titulo) titulo = raw.trim();

  return {
    titulo,
    fecha_inicio: fmtDate(fechaInicio),
    hora,
    rrule,
  };
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
