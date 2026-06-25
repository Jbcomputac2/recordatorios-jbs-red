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

  const headers: Record<string, string> = {
    "Title": titulo,
    "Priority": String(item.prioridad ?? 4),
    "Tags": tags.join(","),
    "Content-Type": "text/plain; charset=utf-8",
  };
  if (item.sonido || categoria?.sonido) headers["X-Sound"] = (item.sonido || categoria!.sonido)!;
  if (item.click_url) headers["Click"] = item.click_url;

  const actions = buildActionsHeader(item.acciones || [], item.id, settings.webhook_secret, origin);
  if (actions) headers["Actions"] = actions;

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

function buildActionsHeader(acciones: Accion[], itemId: number, secret: string, origin: string): string {
  // ntfy soporta hasta 3 acciones.
  return acciones.slice(0, 3).map((a) => {
    if (a.kind === "done") {
      return `http, ${a.label}, ${origin}/api/ntfy?action=done&id=${itemId}&s=${secret}, method=POST, clear=true`;
    }
    if (a.kind === "snooze") {
      return `http, ${a.label}, ${origin}/api/ntfy?action=snooze&id=${itemId}&min=${a.minutes}&s=${secret}, method=POST, clear=true`;
    }
    if (a.kind === "open") {
      return `view, ${a.label}, ${a.url}`;
    }
    return "";
  }).filter(Boolean).join("; ");
}
