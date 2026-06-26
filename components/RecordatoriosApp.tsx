"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Item, Categoria, Settings } from "@/lib/types";
import { rruleHumanLabel } from "@/lib/types";
import { nextOccurrence } from "@/lib/rrule";
import ReminderEditor from "./ReminderEditor";
import SettingsSheet from "./SettingsSheet";

type Filter = "today" | "tomorrow" | "week" | "all";

export default function RecordatoriosApp({ userEmail, userId }: { userEmail: string; userId: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("today");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [it, c, s] = await Promise.all([
      supabase.from("items").select("*").order("next_at", { ascending: true, nullsFirst: false }).limit(500),
      supabase.from("categorias").select("*").order("orden", { ascending: true }),
      supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (!it.error && it.data) setItems(it.data as Item[]);
    if (!c.error && c.data) setCats(c.data as Categoria[]);
    if (!s.error && s.data) setSettings(s.data as Settings);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // ─── Filtros ───────────────────────────────────────
  const now = new Date();
  const startToday = startOfDay(now);
  const startTomorrow = addDays(startToday, 1);
  const startNextWeek = addDays(startToday, 7);

  const filtered = useMemo(() => {
    const inRange = (it: Item, from: Date, to: Date | null) => {
      if (!it.next_at) return false;
      const t = new Date(it.next_at).getTime();
      return t >= from.getTime() && (to == null || t < to.getTime());
    };
    return items.filter((it) => {
      if (filter === "today") return inRange(it, startToday, startTomorrow);
      if (filter === "tomorrow") return inRange(it, startTomorrow, addDays(startTomorrow, 1));
      if (filter === "week") return inRange(it, startToday, startNextWeek);
      return true;
    });
  }, [items, filter]);

  const counts = useMemo(() => ({
    today: items.filter(i => i.next_at && new Date(i.next_at) >= startToday && new Date(i.next_at) < startTomorrow).length,
    tomorrow: items.filter(i => i.next_at && new Date(i.next_at) >= startTomorrow && new Date(i.next_at) < addDays(startTomorrow,1)).length,
    week: items.filter(i => i.next_at && new Date(i.next_at) >= startToday && new Date(i.next_at) < startNextWeek).length,
    all: items.length,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [items]);

  async function toggleActivo(it: Item) {
    const wasActive = it.activo;
    let next_at = it.next_at;
    if (!wasActive) {
      const nx = nextOccurrence({ rrule: it.rrule, fecha_inicio: it.fecha_inicio, fecha_fin: it.fecha_fin, hora: it.hora });
      next_at = nx ? nx.toISOString() : null;
    }
    setItems((prev) => prev.map(x => x.id === it.id ? { ...x, activo: !wasActive, next_at } : x));
    await supabase.from("items").update({ activo: !wasActive, next_at }).eq("id", it.id);
  }

  async function saveItem(patch: Partial<Item>, id: number | "new") {
    // recalcula next_at en cliente
    const merged: any = { ...patch };
    if (merged.rrule !== undefined || merged.hora !== undefined || merged.fecha_inicio !== undefined) {
      const ref = id === "new" ? merged : { ...items.find(x => x.id === id), ...merged };
      const nx = nextOccurrence({
        rrule: ref.rrule ?? null,
        fecha_inicio: ref.fecha_inicio,
        fecha_fin: ref.fecha_fin ?? null,
        hora: ref.hora,
      });
      merged.next_at = nx ? nx.toISOString() : null;
      if (id === "new") merged.activo = nx ? true : false;
    }
    if (id === "new") {
      const { data, error } = await supabase.from("items").insert(merged).select("*").single();
      if (!error && data) setItems((prev) => sortByNext([data as Item, ...prev]));
    } else {
      const { data, error } = await supabase.from("items").update(merged).eq("id", id).select("*").single();
      if (!error && data) setItems((prev) => sortByNext(prev.map(x => x.id === id ? (data as Item) : x)));
    }
    setEditing(null);
  }

  async function deleteItem(id: number) {
    if (!confirm("¿Eliminar este recordatorio?")) return;
    await supabase.from("items").delete().eq("id", id);
    setItems((prev) => prev.filter(x => x.id !== id));
    setEditing(null);
  }

  // ─── Render ────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 120 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "18px 16px 20px" }}>
        {/* Greeting */}
        <div style={{ padding: "18px 6px 12px" }}>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, minHeight: 18 }} suppressHydrationWarning>{mounted ? fmtDateLong(now) : "\u00A0"}</div>
          <h1 style={{ margin: "6px 0 4px", fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.025em", fontWeight: 700 }} suppressHydrationWarning>
            {mounted ? greeting() : "Hola,"} <span style={{
              background: "linear-gradient(135deg, #ff2d55, #af52de)",
              WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
            }}>Profe</span>
          </h1>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {counts.today === 0 ? "Sin nada hoy ✨" :
              <>Tienes <strong style={{ color: "var(--text)" }}>{counts.today} recordatorio{counts.today === 1 ? "" : "s"}</strong> hoy</>}
          </div>
        </div>

        {/* Chips */}
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8, marginBottom: 6 }}>
          <Chip active={filter === "today"} onClick={() => setFilter("today")}>Hoy · {counts.today}</Chip>
          <Chip active={filter === "tomorrow"} onClick={() => setFilter("tomorrow")}>Mañana · {counts.tomorrow}</Chip>
          <Chip active={filter === "week"} onClick={() => setFilter("week")}>Semana · {counts.week}</Chip>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos · {counts.all}</Chip>
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "grid", placeItems: "center", padding: 60 }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState onAdd={() => setEditing("new")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((it) => (
              <Card key={it.id} item={it} cats={cats}
                onToggle={() => toggleActivo(it)}
                onOpen={() => setEditing(it)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setEditing("new")} aria-label="Nuevo recordatorio">+</button>

      {/* Tab bar */}
      <nav className="tabbar">
        <button className="tab" aria-current={!showSettings}>
          <span className="icon">📋</span>
          <span className="label">Hoy</span>
        </button>
        <button className="tab" onClick={() => setFilter("week")}>
          <span className="icon">📅</span>
          <span className="label">Semana</span>
        </button>
        <button className="tab" onClick={() => setFilter("all")}>
          <span className="icon">🏷️</span>
          <span className="label">Todos</span>
        </button>
        <button className="tab" aria-current={showSettings} onClick={() => setShowSettings(true)}>
          <span className="icon">⚙️</span>
          <span className="label">Ajustes</span>
        </button>
      </nav>

      {/* Editor sheet */}
      {editing !== null && (
        <ReminderEditor
          item={editing === "new" ? null : editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSave={(patch) => saveItem(patch, editing === "new" ? "new" : (editing as Item).id)}
          onDelete={editing === "new" ? undefined : () => deleteItem((editing as Item).id)}
        />
      )}

      {/* Settings sheet */}
      {showSettings && settings && (
        <SettingsSheet
          settings={settings}
          userEmail={userEmail}
          onClose={() => setShowSettings(false)}
          onChange={async (patch) => {
            const { data } = await supabase.from("settings").update(patch).eq("user_id", userId).select("*").single();
            if (data) setSettings(data as Settings);
          }}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────
function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return <button className="chip" aria-pressed={active} onClick={onClick}>{children}</button>;
}

function Card({ item, cats, onToggle, onOpen }: {
  item: Item; cats: Categoria[]; onToggle: () => void; onOpen: () => void;
}) {
  const cat = cats.find(c => c.id === item.categoria_id);
  const emoji = cat?.emoji ?? "📌";
  const color = cat?.color ?? "#8e8e93";
  const off = !item.activo;
  const hora = item.hora.slice(0, 5);
  return (
    <div className="glass" style={{
      padding: "13px 14px 13px 13px", display: "flex", gap: 12, alignItems: "flex-start",
      opacity: off ? 0.6 : 1,
    }}>
      <button onClick={onOpen} style={{
        width: 44, height: 44, borderRadius: 12,
        background: `linear-gradient(135deg, ${color}, ${shade(color, 0.8)})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
        boxShadow: `0 4px 10px ${hexA(color, 0.3)}`,
      }}>{emoji}</button>
      <button onClick={onOpen} style={{
        flex: 1, minWidth: 0, textAlign: "left",
      }}>
        <div style={{
          fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.2,
          textDecoration: off ? "line-through" : "none",
          textDecorationColor: "var(--text-tertiary)",
        }}>
          {item.titulo || "Sin título"}
        </div>
        <div style={{
          display: "flex", gap: 6, alignItems: "center", marginTop: 4,
          fontSize: 12, color: "var(--text-muted)",
        }}>
          <span style={{ color, fontWeight: 600 }}>{hora}</span>
          <span>·</span>
          <span>{rruleHumanLabel(item.rrule)}</span>
          {item.prioridad >= 5 && (<><span>·</span><span style={{ color: "var(--red)" }}>🔔 alta</span></>)}
        </div>
        {item.click_url && (
          <div style={{
            marginTop: 6, padding: "3px 8px",
            background: hexA(color, 0.1), borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, color, fontWeight: 500,
          }}>🔗 link</div>
        )}
      </button>
      <button className="toggle" data-on={item.activo} onClick={onToggle} aria-label="Activo">
        <div className="knob" />
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="glass" style={{ padding: 36, textAlign: "center" }}>
      <div style={{ fontSize: 56, marginBottom: 8 }}>🌤️</div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Nada por ahora</div>
      <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
        Toca el botón <strong style={{ color: "var(--text)" }}>+</strong> para crear tu primer recordatorio.
      </div>
      <button onClick={onAdd} style={{
        padding: "10px 18px", borderRadius: 12,
        background: "linear-gradient(135deg, #ff2d55, #af52de)",
        color: "#fff", fontWeight: 600,
        boxShadow: "0 6px 18px rgba(255,45,85,0.35)",
      }}>+ Nuevo recordatorio</button>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────
function sortByNext(items: Item[]) {
  return [...items].sort((a, b) => {
    if (!a.next_at && !b.next_at) return 0;
    if (!a.next_at) return 1;
    if (!b.next_at) return -1;
    return new Date(a.next_at).getTime() - new Date(b.next_at).getTime();
  });
}
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDateLong(d: Date) {
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
}
function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches,";
  if (h < 12) return "Buenos días,";
  if (h < 19) return "Buenas tardes,";
  return "Buenas noches,";
}
function hexA(hex: string, a: number) {
  const m = hex.replace("#","").match(/(..)(..)(..)/);
  if (!m) return hex;
  const [_, r, g, b] = m;
  return `rgba(${parseInt(r,16)}, ${parseInt(g,16)}, ${parseInt(b,16)}, ${a})`;
}
function shade(hex: string, factor: number) {
  const m = hex.replace("#","").match(/(..)(..)(..)/);
  if (!m) return hex;
  const [_, r, g, b] = m.slice(1);
  const f = (v: string) => Math.max(0, Math.min(255, Math.round(parseInt(v,16) * factor + 255 * (1-factor) * 0.4)));
  return `#${[r,g,b].map(v => f(v).toString(16).padStart(2,"0")).join("")}`;
}
