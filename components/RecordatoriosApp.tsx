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
    today:    items.filter(i => i.next_at && new Date(i.next_at) >= startToday    && new Date(i.next_at) < startTomorrow).length,
    tomorrow: items.filter(i => i.next_at && new Date(i.next_at) >= startTomorrow && new Date(i.next_at) < addDays(startTomorrow,1)).length,
    week:     items.filter(i => i.next_at && new Date(i.next_at) >= startToday    && new Date(i.next_at) < startNextWeek).length,
    all:      items.length,
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

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 130 }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 20px" }}>
        {/* Greeting */}
        <div style={{ padding: "40px 4px 18px" }}>
          <div suppressHydrationWarning style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
            letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-muted)",
            minHeight: 12,
          }}>
            {mounted ? fmtDateLong(now) : "\u00A0"}
          </div>
          <h1 suppressHydrationWarning style={{
            fontFamily: "var(--font-serif)", fontSize: 56, lineHeight: 0.95,
            letterSpacing: "-0.04em", margin: "16px 0 0", fontWeight: 400,
          }}>
            {mounted ? greetingFirst() : "Hola"}<br />
            <em style={{ fontStyle: "italic" }}>{mounted ? greetingSecond() : "."}</em>
          </h1>
          <div style={{ fontSize: 14, color: "var(--text-soft)", marginTop: 16, lineHeight: 1.4 }}>
            {counts.today === 0 ? "Sin nada hoy ✨" : (
              <>Tienes <strong style={{ color: "var(--text)" }}>{counts.today} {counts.today === 1 ? "cosa" : "cosas"}</strong> hoy
              {counts.tomorrow > 0 && <> y <strong style={{ color: "var(--text)" }}>{counts.tomorrow} mañana</strong></>}.</>
            )}
          </div>
        </div>

        {/* Filter rail */}
        <div style={{
          display: "flex", gap: 22, borderBottom: "0.5px solid var(--line)",
          padding: "4px 4px 0", overflowX: "auto",
        }}>
          <FilterTab label="Hoy"     count={counts.today}    active={filter === "today"}    onClick={() => setFilter("today")} />
          <FilterTab label="Mañana"  count={counts.tomorrow} active={filter === "tomorrow"} onClick={() => setFilter("tomorrow")} />
          <FilterTab label="Semana"  count={counts.week}     active={filter === "week"}     onClick={() => setFilter("week")} />
          <FilterTab label="Todos"   count={counts.all}      active={filter === "all"}      onClick={() => setFilter("all")} />
        </div>

        {/* List */}
        <div style={{ paddingTop: 12 }}>
          {loading ? (
            <div style={{ display: "grid", placeItems: "center", padding: 60 }}><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={() => setEditing("new")} />
          ) : (
            <div>
              {filtered.map((it) => (
                <Row key={it.id} item={it} cats={cats}
                  onToggle={() => toggleActivo(it)}
                  onDelete={() => deleteItem(it.id)}
                  onOpen={() => setEditing(it)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setEditing("new")} aria-label="Nuevo recordatorio">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {/* Tab bar */}
      <nav className="tabbar">
        <button className="tab" aria-current={!showSettings} onClick={() => { setShowSettings(false); setFilter("today"); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
          <span className="label">Hoy</span>
        </button>
        <button className="tab" onClick={() => { setShowSettings(false); setFilter("all"); }} aria-current={!showSettings && filter === "all"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          <span className="label">Todos</span>
        </button>
        <button className="tab" aria-current={showSettings} onClick={() => setShowSettings(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          <span className="label">Ajustes</span>
        </button>
      </nav>

      {editing !== null && (
        <ReminderEditor
          item={editing === "new" ? null : editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSave={(patch) => saveItem(patch, editing === "new" ? "new" : (editing as Item).id)}
          onDelete={editing === "new" ? undefined : () => deleteItem((editing as Item).id)}
        />
      )}

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

function FilterTab({ label, count, active, onClick }: { label: string; count: number; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      paddingBottom: 12,
      borderBottom: active ? "1.5px solid #000" : "1.5px solid transparent",
      marginBottom: -1,
      display: "flex", alignItems: "baseline", gap: 5,
      color: active ? "var(--text)" : "var(--text-muted)",
      fontWeight: active ? 600 : 500,
      fontSize: 13,
      letterSpacing: "-0.01em",
      flexShrink: 0,
    }}>
      {label}
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.5, fontWeight: 500,
      }}>{String(count).padStart(2, "0")}</span>
    </button>
  );
}

function CategoryIcon({ cat }: { cat: Categoria | undefined }) {
  // Lucide-style outline icons by category emoji
  const e = cat?.emoji;
  const stroke = "currentColor";
  const props = { width: 13, height: 13, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (e === "💊") return (<svg {...props}><path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9l-9.9 9.9Z" /><path d="m9 14 6-6" /></svg>);
  if (e === "📅") return (<svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>);
  if (e === "🏃") return (<svg {...props}><path d="M13 4a2 2 0 1 0 0-2 2 2 0 0 0 0 2zM6 17l3-3 2 4 4-3 3 5" /><path d="M4 22l3-7 4-2-3-5" /></svg>);
  if (e === "💰") return (<svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h5a2 2 0 1 1 0 4H9" /></svg>);
  if (e === "📞") return (<svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>);
  if (e === "🎂") return (<svg {...props}><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16h16M10 8a2 2 0 1 1 4 0c0 1.5-2 2-2 4M2 21h20" /></svg>);
  // default pushpin
  return (<svg {...props}><path d="M12 17v5M5 8l7 7 7-7M9 3l3 3 3-3" /></svg>);
}

function Row({ item, cats, onToggle, onOpen, onDelete }: {
  item: Item; cats: Categoria[]; onToggle: () => void; onOpen: () => void; onDelete: () => void;
}) {
  const cat = cats.find(c => c.id === item.categoria_id);
  const off = !item.activo;
  const hora = item.hora.slice(0, 5);
  return (
    <div style={{
      display: "flex", gap: 14, padding: "16px 4px",
      borderBottom: "0.5px solid var(--line-2)",
      opacity: off ? 0.4 : 1,
      alignItems: "center",
    }}>
      <button onClick={onOpen} style={{
        fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)",
        fontWeight: 600, width: 46, textAlign: "left", letterSpacing: "-0.02em",
        flexShrink: 0,
      }}>{hora}</button>

      <button onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <div style={{
          fontSize: 15, fontWeight: 600, letterSpacing: "-0.015em",
          textDecoration: off ? "line-through" : "none",
          textDecorationColor: "var(--text-tertiary)",
          lineHeight: 1.2,
        }}>
          {item.titulo || "Sin título"}
        </div>
        <div style={{
          display: "flex", gap: 6, alignItems: "center", marginTop: 3,
          fontSize: 11, color: "var(--text-muted)", letterSpacing: 0,
        }}>
          <CategoryIcon cat={cat} />
          <span>{cat?.nombre ?? "Sin categoría"}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{rruleHumanLabel(item.rrule)}</span>
          {item.prioridad >= 5 && <>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ color: "var(--red)", fontWeight: 600 }}>urgente</span>
          </>}
        </div>
      </button>

      <button className="toggle" data-on={item.activo} onClick={onToggle} aria-label="Activo">
        <div className="knob" />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label="Eliminar"
        title="Eliminar"
        style={{
          width: 32, height: 32, borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-muted)", flexShrink: 0,
          background: "transparent",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fee"; e.currentTarget.style.color = "var(--red)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 48, fontStyle: "italic", color: "var(--text)", letterSpacing: "-0.04em" }}>
        Nada.
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
        Sin recordatorios. Toca <strong style={{ color: "var(--text)" }}>+</strong> para añadir.
      </div>
      <button onClick={onAdd} style={{
        marginTop: 22, padding: "10px 18px", borderRadius: 12,
        background: "#000", color: "#fff", fontWeight: 600, fontSize: 13,
        letterSpacing: "0.02em",
      }}>+ Nuevo</button>
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
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}
function greetingFirst() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas";
  if (h < 12) return "Buenos";
  if (h < 19) return "Buenas";
  return "Buenas";
}
function greetingSecond() {
  const h = new Date().getHours();
  if (h < 6) return "noches.";
  if (h < 12) return "días.";
  if (h < 19) return "tardes.";
  return "noches.";
}
