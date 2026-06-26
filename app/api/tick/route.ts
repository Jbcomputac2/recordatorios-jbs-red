import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { nextOccurrence } from "@/lib/rrule";
import { sendNtfy } from "@/lib/ntfy";
import type { Item, Categoria, Settings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    db: { schema: "recordatorios" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function originOf(req: NextRequest) {
  const host = req.headers.get("host");
  return host ? `https://${host}` : req.nextUrl.origin;
}

function isWithinQuiet(now: Date, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const m = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + sm, e = eh * 60 + em;
  return s <= e ? (m >= s && m < e) : (m >= s || m < e); // cruza medianoche
}

export async function POST(req: NextRequest) {
  // ─── Autoriza ─────────────────────────────────────────
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m || m[1] !== process.env.TICK_SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sb = admin();
  const origin = originOf(req);
  const now = new Date();

  // ─── Items con next_at vencido ────────────────────────
  const { data: items, error } = await sb
    .from("items")
    .select("*")
    .lte("next_at", now.toISOString())
    .eq("activo", true)
    .limit(200);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!items || !items.length) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // settings + cats por usuario, cacheadas
  const userIds = Array.from(new Set(items.map((i: any) => i.user_id)));
  const [{ data: settingsList }, { data: cats }] = await Promise.all([
    sb.from("settings").select("*").in("user_id", userIds),
    sb.from("categorias").select("*").in("user_id", userIds),
  ]);
  const settingsByUser = new Map<string, Settings>();
  (settingsList || []).forEach((s: any) => settingsByUser.set(s.user_id, s as Settings));
  const catById = new Map<number, Categoria>();
  (cats || []).forEach((c: any) => catById.set(c.id, c as Categoria));

  let sent = 0;
  const results: Array<{id:number; ok:boolean; err?:string}> = [];

  for (const raw of items as any[]) {
    const item = raw as Item;
    try {
      const settings = settingsByUser.get((raw as any).user_id);
      if (!settings) throw new Error("sin settings");

      // Quiet hours
      const quiet = isWithinQuiet(now, settings.quiet_start, settings.quiet_end);
      let nextAt: Date | null = null;

      if (quiet && settings.quiet_carry) {
        // Reprograma para el fin de quiet hours
        const [eh, em] = (settings.quiet_end ?? "07:00").split(":").map(Number);
        const wake = new Date(now);
        wake.setHours(eh, em, 0, 0);
        if (wake.getTime() <= now.getTime()) wake.setDate(wake.getDate() + 1);
        await sb.from("items").update({ next_at: wake.toISOString() }).eq("id", item.id);
        results.push({ id: item.id, ok: true });
        continue;
      }
      if (quiet && !settings.quiet_carry) {
        // Skip y reprograma a la siguiente ocurrencia normal
        nextAt = nextOccurrence({
          rrule: item.rrule, fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin,
          hora: item.hora, from: new Date(now.getTime() + 60_000),
        });
        await sb.from("items").update({
          next_at: nextAt ? nextAt.toISOString() : null,
          activo: nextAt ? true : false,
        }).eq("id", item.id);
        continue;
      }

      // Envía
      const cat = item.categoria_id != null ? (catById.get(item.categoria_id) ?? null) : null;
      await sendNtfy({ settings, item, categoria: cat, origin });
      sent++;

      // Próxima: si está en modo "repetir cada X min hasta Hecho", reprograma a now + X min.
      // En cualquier otro caso, usa la regla normal (RRULE o null para una-vez).
      const repetir = (item as any).repetir_cada_min as number | null | undefined;
      if (repetir && repetir > 0) {
        nextAt = new Date(now.getTime() + repetir * 60_000);
      } else {
        nextAt = nextOccurrence({
          rrule: item.rrule, fecha_inicio: item.fecha_inicio, fecha_fin: item.fecha_fin,
          hora: item.hora, from: new Date(now.getTime() + 60_000),
        });
      }

      await sb.from("items").update({
        last_sent_at: now.toISOString(),
        next_at: nextAt ? nextAt.toISOString() : null,
        activo: nextAt ? true : false,
      }).eq("id", item.id);

      await sb.from("eventos").insert({
        item_id: item.id,
        user_id: (raw as any).user_id,
        scheduled_at: now.toISOString(),
        sent_at: now.toISOString(),
        status: "sent",
      });

      results.push({ id: item.id, ok: true });
    } catch (err: any) {
      results.push({ id: item.id, ok: false, err: err?.message ?? String(err) });
      await sb.from("eventos").insert({
        item_id: item.id, user_id: (raw as any).user_id,
        scheduled_at: now.toISOString(), status: "failed",
        detalle: String(err?.message ?? err).slice(0, 500),
      });
    }
  }

  return NextResponse.json({ ok: true, sent, total: items.length, results });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST con Bearer TICK_SECRET para disparar" });
}
