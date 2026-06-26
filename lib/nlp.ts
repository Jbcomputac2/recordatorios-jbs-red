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

const NUM_WORDS: Record<string, number> = {
  un: 1, una: 1, uno: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30,
  "media": 0.5, "medio": 0.5,
};

function parseNum(w: string): number | null {
  if (!w) return null;
  const n = parseFloat(w);
  if (!isNaN(n)) return n;
  return NUM_WORDS[w] ?? null;
}

export function parseEs(text: string, now: Date = new Date()): Parsed {
  const raw = text;
  let s = " " + text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + " ";
  const tokensToStrip: string[] = [];

  // "recuerdame que / de / a" → quitar del título
  tokensToStrip.push("recuerdame que", "recuerdame de", "recuerdame a", "recuerdame", "recuérdame que", "recuérdame de", "recuérdame a", "recuérdame", "que tengo", "tengo", "que");

  // ── OFFSETS RELATIVOS: "en/dentro de X minutos|horas|dias" ──
  let offsetHandled = false;
  const offRe = /\b(?:en|dentro de)\s+(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|media|medio)\s*(minutos?|mins?|horas?|hrs?|h|dias?|semanas?|meses)\b/;
  const mOff = s.match(offRe);
  if (mOff) {
    const n = parseNum(mOff[1]) ?? 1;
    const unit = mOff[2];
    let when = new Date(now);
    if (/^min|^m$/.test(unit)) when = new Date(now.getTime() + n * 60_000);
    else if (/^h/.test(unit)) when = new Date(now.getTime() + n * 3_600_000);
    else if (/^d/.test(unit)) when = new Date(now.getTime() + n * 86_400_000);
    else if (/^s/.test(unit)) when = new Date(now.getTime() + n * 7 * 86_400_000);
    else if (/^mes/.test(unit)) { when = new Date(now); when.setMonth(when.getMonth() + n); }
    const fechaIni = when;
    tokensToStrip.push(mOff[0].trim(), "en", "dentro", "dentro de", "de");
    // strip y devolver pronto
    let titulo = stripTokens(raw, tokensToStrip);
    return {
      titulo,
      fecha_inicio: fmtDate(fechaIni),
      hora: `${pad(when.getHours())}:${pad(when.getMinutes())}`,
      rrule: null,
    };
  }

  // hora
  let hora = "09:00";
  const horaMatchers = [
    /\b(\d{1,2})\s*menos\s*(\d{1,2}|cuarto|veinte|diez|cinco)\b/,
    /\b(\d{1,2}|cuarto|veinte|diez|cinco)\s+para\s+las?\s+(\d{1,2})\b/,
    /\ba las (\d{1,2})(?::(\d{2}))?\s*(am|pm|de la (?:noche|tarde|manana|madrugada))?\b/,
    /\b(\d{1,2}):(\d{2})\s*(am|pm|de la (?:noche|tarde|manana|madrugada))?\b/,
    /\b(\d{1,2})\s*(am|pm|de la (?:noche|tarde|manana|madrugada))\b/,
  ];
  for (let i = 0; i < horaMatchers.length; i++) {
    const re = horaMatchers[i];
    const m = s.match(re);
    if (!m) continue;
    if (i === 0) {
      // "5 menos cuarto" → 4:45
      const h = parseInt(m[1]);
      const minWord = m[2];
      const min = minWord === "cuarto" ? 15 : (parseNum(minWord) ?? 0);
      const totalMin = h * 60 - min;
      const hh = Math.floor(((totalMin % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
      const mm = ((totalMin % 60) + 60) % 60;
      hora = `${pad(hh)}:${pad(mm)}`;
    } else if (i === 1) {
      // "15 para las 5" → 4:45
      const minWord = m[1];
      const h = parseInt(m[2]);
      const min = minWord === "cuarto" ? 15 : (parseNum(minWord) ?? parseInt(minWord) ?? 0);
      const totalMin = h * 60 - min;
      const hh = Math.floor(((totalMin % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
      const mm = ((totalMin % 60) + 60) % 60;
      hora = `${pad(hh)}:${pad(mm)}`;
    } else {
      let h = parseInt(m[1]);
      const mm = parseInt(m[2] || "0");
      const ap = (m[3] || "").toLowerCase();
      // "de la noche/tarde" = pm; "de la manana/madrugada" = am
      const isPM = ap === "pm" || /de la (noche|tarde)/.test(ap);
      const isAM = ap === "am" || /de la (manana|madrugada)/.test(ap);
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      hora = `${pad(h)}:${pad(mm)}`;
    }
    tokensToStrip.push(m[0].trim());
    break;
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
  if (/\bpasado manana\b/.test(s) || /\bpasado mañana\b/.test(text.toLowerCase())) {
    fechaInicio = addDays(today, 2);
    tokensToStrip.push("pasado manana", "pasado mañana", "pasado");
  } else if (/\bmanana\b/.test(s) || /\bmañana\b/.test(text.toLowerCase())) {
    fechaInicio = addDays(today, 1);
    tokensToStrip.push("manana", "mañana");
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

  const titulo = stripTokens(raw, tokensToStrip);

  return {
    titulo,
    fecha_inicio: fmtDate(fechaInicio),
    hora,
    rrule,
  };
}

function stripTokens(raw: string, tokens: string[]): string {
  let titulo = raw;
  // ordenar tokens del más largo al más corto para no cortar palabras prematuramente
  const sorted = [...tokens].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const t of sorted) {
    titulo = titulo.replace(new RegExp(escapeRe(t), "ig"), " ");
  }
  titulo = titulo.replace(/\b(a las|las|a|el|los|de|por|para|con|una|un)\b/gi, " ");
  titulo = titulo.replace(/\s+/g, " ").trim();
  // capitaliza primera letra
  if (titulo) titulo = titulo[0].toUpperCase() + titulo.slice(1);
  if (!titulo) titulo = raw.trim();
  return titulo;
}

function pad(n: number) { return String(n).padStart(2, "0"); }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
