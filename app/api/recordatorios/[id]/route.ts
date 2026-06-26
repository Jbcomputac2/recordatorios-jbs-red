// PATCH / DELETE de un recordatorio específico.
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

function authorize(req: NextRequest): { ok: true } | { ok: false; res: NextResponse } {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const expected = process.env.API_TOKEN;
  if (!expected) return { ok: false, res: NextResponse.json({ ok: false, error: "API_TOKEN no configurado" }, { status: 500 }) };
  if (!m || m[1] !== expected) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { ok: true };
}

async function userIdOf(sb: ReturnType<typeof admin>): Promise<string | null> {
  if (process.env.API_USER_ID) return process.env.API_USER_ID;
  const { data } = await sb.from("settings").select("user_id").limit(1).maybeSingle();
  return (data as any)?.user_id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const a = authorize(req); if (!a.ok) return a.res;
  const sb = admin();
  const userId = await userIdOf(sb);
  if (!userId) return NextResponse.json({ ok: false, error: "sin usuario" }, { status: 500 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "body no es JSON" }, { status: 400 }); }

  // Whitelist de campos editables
  const patch: any = {};
  const allowed = ["titulo","descripcion","categoria_id","fecha_inicio","fecha_fin","hora","rrule","prioridad","click_url","acciones","repetir_cada_min","activo"];
  for (const k of allowed) if (k in body) patch[k] = body[k];

  // Normaliza hora
  if (typeof patch.hora === "string" && patch.hora.length === 5) patch.hora = patch.hora + ":00";

  // Si tocaron hora/fecha/rrule, recalcula next_at
  const recalc = "fecha_inicio" in patch || "hora" in patch || "rrule" in patch || "fecha_fin" in patch;
  if (recalc) {
    const { data: cur } = await sb.from("items").select("fecha_inicio,fecha_fin,hora,rrule").eq("id", params.id).eq("user_id", userId).maybeSingle();
    if (!cur) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    const next = nextOccurrence({
      rrule: patch.rrule ?? (cur as any).rrule,
      fecha_inicio: patch.fecha_inicio ?? (cur as any).fecha_inicio,
      fecha_fin: patch.fecha_fin ?? (cur as any).fecha_fin,
      hora: patch.hora ?? (cur as any).hora,
      from: new Date(),
    });
    patch.next_at = next ? next.toISOString() : null;
    if (!("activo" in patch)) patch.activo = next != null;
  }

  const { data, error } = await sb.from("items").update(patch).eq("id", params.id).eq("user_id", userId).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });

  return NextResponse.json({ ok: true, recordatorio: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const a = authorize(req); if (!a.ok) return a.res;
  const sb = admin();
  const userId = await userIdOf(sb);
  if (!userId) return NextResponse.json({ ok: false, error: "sin usuario" }, { status: 500 });

  const { error } = await sb.from("items").delete().eq("id", params.id).eq("user_id", userId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = authorize(req); if (!a.ok) return a.res;
  const sb = admin();
  const userId = await userIdOf(sb);
  if (!userId) return NextResponse.json({ ok: false, error: "sin usuario" }, { status: 500 });
  const { data, error } = await sb.from("items").select("*").eq("id", params.id).eq("user_id", userId).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, recordatorio: data });
}
