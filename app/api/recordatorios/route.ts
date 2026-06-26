// API pública para que IAs externas creen/listen recordatorios.
// Auth: Authorization: Bearer <API_TOKEN>
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseEs } from "@/lib/nlp";
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
  if (!expected) return { ok: false, res: NextResponse.json({ ok: false, error: "API_TOKEN no configurado en el servidor" }, { status: 500 }) };
  if (!m || m[1] !== expected) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  return { ok: true };
}

// El user_id objetivo. Por ahora es un setup mono-usuario:
// si tienes API_USER_ID en env, lo usamos. Si no, agarramos el único user con settings.
async function resolveUserId(sb: ReturnType<typeof admin>): Promise<string | null> {
  if (process.env.API_USER_ID) return process.env.API_USER_ID;
  const { data } = await sb.from("settings").select("user_id").limit(1).maybeSingle();
  return (data as any)?.user_id ?? null;
}

// ─────────────────────────────────────────────────────────
// GET /api/recordatorios — lista los últimos 100
// ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const a = authorize(req);
  if (!a.ok) return a.res;
  const sb = admin();
  const userId = await resolveUserId(sb);
  if (!userId) return NextResponse.json({ ok: false, error: "sin usuario" }, { status: 500 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 100), 500);
  const onlyActive = url.searchParams.get("activo");

  let q = sb.from("items").select("*").eq("user_id", userId).order("next_at", { ascending: true, nullsFirst: false }).limit(limit);
  if (onlyActive === "true") q = q.eq("activo", true);
  if (onlyActive === "false") q = q.eq("activo", false);

  const { data, error } = await q;
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: data?.length ?? 0, recordatorios: data });
}

// ─────────────────────────────────────────────────────────
// POST /api/recordatorios — crear
// ─────────────────────────────────────────────────────────
// Body: { titulo, fecha_inicio, hora, rrule?, categoria_slug?, descripcion?, prioridad?, click_url?, repetir_cada_min?, acciones? }
// O bien: { texto: "mañana 7am tomar pastilla" }  → parsea con NLP
export async function POST(req: NextRequest) {
  const a = authorize(req);
  if (!a.ok) return a.res;

  const sb = admin();
  const userId = await resolveUserId(sb);
  if (!userId) return NextResponse.json({ ok: false, error: "sin usuario" }, { status: 500 });

  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "body no es JSON" }, { status: 400 }); }

  // Parseo NLP si llega `texto`
  let parsed: { titulo?: string; fecha_inicio?: string; hora?: string; rrule?: string | null } = {};
  if (body.texto && typeof body.texto === "string") {
    const p = parseEs(body.texto);
    parsed = { titulo: p.titulo, fecha_inicio: p.fecha_inicio, hora: p.hora, rrule: p.rrule };
  }

  const titulo = body.titulo ?? parsed.titulo;
  const fecha_inicio = body.fecha_inicio ?? parsed.fecha_inicio;
  const hora = body.hora ?? parsed.hora ?? "09:00";
  const rrule = body.rrule ?? parsed.rrule ?? null;

  if (!titulo) return NextResponse.json({ ok: false, error: "falta titulo (o usa `texto`)" }, { status: 400 });
  if (!fecha_inicio) return NextResponse.json({ ok: false, error: "falta fecha_inicio (YYYY-MM-DD)" }, { status: 400 });

  // Categoría por slug/nombre (opcional)
  let categoria_id: number | null = null;
  if (body.categoria_slug) {
    const slug = String(body.categoria_slug).toLowerCase();
    const { data: cats } = await sb.from("categorias").select("id,nombre").eq("user_id", userId);
    const match = (cats || []).find((c: any) => c.nombre.toLowerCase().includes(slug) || slug.includes(c.nombre.toLowerCase()));
    if (match) categoria_id = (match as any).id;
  }
  if (body.categoria_id) categoria_id = Number(body.categoria_id);

  // next_at calculado
  const next = nextOccurrence({
    rrule, fecha_inicio, fecha_fin: body.fecha_fin ?? null,
    hora: hora.length === 5 ? hora + ":00" : hora,
    from: new Date(),
  });

  const insert = {
    user_id: userId,
    titulo: String(titulo).slice(0, 200),
    descripcion: body.descripcion ?? null,
    categoria_id,
    fecha_inicio,
    fecha_fin: body.fecha_fin ?? null,
    hora: hora.length === 5 ? hora + ":00" : hora,
    rrule,
    prioridad: typeof body.prioridad === "number" ? Math.max(1, Math.min(5, body.prioridad)) : 3,
    click_url: body.click_url ?? null,
    acciones: body.acciones ?? [
      { label: "Hecho", kind: "done" },
      { label: "+10 min", kind: "snooze", minutes: 10 },
      { label: "+1 hora", kind: "snooze", minutes: 60 },
    ],
    repetir_cada_min: body.repetir_cada_min ?? null,
    activo: next != null,
    next_at: next ? next.toISOString() : null,
  };

  const { data, error } = await sb.from("items").insert(insert).select("*").single();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, recordatorio: data }, { status: 201 });
}
