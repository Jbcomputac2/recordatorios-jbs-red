import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nextOccurrence } from "@/lib/rrule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "recordatorios" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Botones de la notificación llaman aquí (vía Actions http).
// /api/ntfy?action=done&id=123&s=<webhook_secret>
// /api/ntfy?action=snooze&id=123&min=10&s=<webhook_secret>
export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const action = u.searchParams.get("action");
  const id = Number(u.searchParams.get("id"));
  const secret = u.searchParams.get("s");
  if (!action || !id || !secret) {
    return NextResponse.json({ ok: false, error: "params" }, { status: 400 });
  }
  const sb = admin();

  // Trae item + settings para validar secret
  const { data: item } = await sb.from("items").select("*").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  const { data: settings } = await sb.from("settings").select("webhook_secret").eq("user_id", (item as any).user_id).maybeSingle();
  if (!settings || (settings as any).webhook_secret !== secret) {
    return NextResponse.json({ ok: false, error: "bad secret" }, { status: 403 });
  }

  const now = new Date();

  if (action === "done") {
    // Marca y reprograma la siguiente ocurrencia normal
    const nx = nextOccurrence({
      rrule: (item as any).rrule, fecha_inicio: (item as any).fecha_inicio,
      fecha_fin: (item as any).fecha_fin, hora: (item as any).hora,
      from: new Date(now.getTime() + 60_000),
    });
    await sb.from("items").update({
      last_done_at: now.toISOString(),
      next_at: nx ? nx.toISOString() : null,
      activo: nx ? true : false,
    }).eq("id", id);
    await sb.from("eventos").insert({
      item_id: id, user_id: (item as any).user_id,
      scheduled_at: now.toISOString(), sent_at: now.toISOString(), status: "done",
    });
    return NextResponse.json({ ok: true, action: "done" });
  }

  if (action === "snooze") {
    const min = Number(u.searchParams.get("min") || "10");
    const next = new Date(now.getTime() + min * 60_000);
    await sb.from("items").update({
      next_at: next.toISOString(),
      activo: true, // ← clave: el cron filtra por activo=true
    }).eq("id", id);
    await sb.from("eventos").insert({
      item_id: id, user_id: (item as any).user_id,
      scheduled_at: now.toISOString(), status: "snoozed",
      detalle: `+${min}min`,
    });
    return NextResponse.json({ ok: true, action: "snooze", min });
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}

// ntfy puede pegar GET en algunos clientes — aceptamos ambos.
export async function GET(req: NextRequest) { return POST(req); }
