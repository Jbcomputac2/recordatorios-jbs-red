// Envía notificaciones a ntfy. Solo servidor (incluye credenciales si fueran necesarias).
import type { Item, Categoria, Settings, Accion } from "./types";

type SendArgs = {
  settings: Settings;
  item: Item;
  categoria: Categoria | null;
  /** Origen público de la app, para construir click + webhooks. Ej "https://recordatorios.jbs.red" */
  origin: string;
};

export async function sendNtfy({ settings, item, categoria, origin }: SendArgs) {
  const url = `${settings.ntfy_url.replace(/\/+$/, "")}/${settings.ntfy_topic}`;
  const emoji = categoria?.emoji ?? "🔔";
  const titulo = `${emoji} ${item.titulo}`;
  const body = item.descripcion ?? subtitleFor(item, categoria);
  const tags = ["bell"];
  if (categoria?.emoji) tags.unshift(emojiToTag(categoria.emoji));

  const raw: Record<string, string> = {
    "Title": titulo,
    "Priority": String(item.prioridad ?? 4),
    "Tags": tags.join(","),
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (item.sonido || categoria?.sonido) raw["X-Sound"] = (item.sonido || categoria!.sonido)!;
  if (item.click_url) raw["Click"] = item.click_url;

  const actions = buildActionsHeader(item.acciones || [], item.id, settings.webhook_secret, origin);
  if (actions) raw["Actions"] = actions;

  // Garantiza que NINGÚN header lleve caracteres fuera de Latin-1 (emoji, etc).
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) headers[k] = encodeHeader(v);

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ntfy ${res.status}: ${t}`);
  }
}

function subtitleFor(item: Item, cat: Categoria | null) {
  const t = item.hora.slice(0, 5);
  if (!item.rrule) return `Hoy · ${t}`;
  if (item.rrule === "FREQ=DAILY") return `Cada día · ${t}`;
  return `${t} · ${cat?.nombre ?? ""}`;
}

function emojiToTag(e: string): string {
  const map: Record<string, string> = {
    "💊": "pill", "📅": "calendar", "🏃": "runner", "💰": "moneybag",
    "📞": "telephone_receiver", "📌": "pushpin", "🎂": "birthday",
  };
  return map[e] ?? "bell";
}

// HTTP headers solo aceptan ASCII/Latin-1. Codifica con RFC 2047 si trae caracteres fuera de rango.
function encodeHeader(value: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\xFF]*$/.test(value)) return value;
  const b64 = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

function buildActionsHeader(acciones: Accion[], itemId: number, secret: string, origin: string): string {
  // ntfy soporta hasta 3 acciones. Headers HTTP solo aceptan Latin-1, así que limpiamos los labels.
  return acciones.slice(0, 3).map((a) => {
    const label = stripNonLatin1(a.label);
    if (a.kind === "done") {
      return `http, ${label}, ${origin}/api/ntfy?action=done&id=${itemId}&s=${secret}, method=POST, clear=true`;
    }
    if (a.kind === "snooze") {
      return `http, ${label}, ${origin}/api/ntfy?action=snooze&id=${itemId}&min=${a.minutes}&s=${secret}, method=POST, clear=true`;
    }
    if (a.kind === "open") {
      return `view, ${label}, ${a.url}`;
    }
    return "";
  }).filter(Boolean).join("; ");
}

function stripNonLatin1(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[^\x00-\xFF]/g, "").replace(/\s+/g, " ").trim() || "OK";
}
