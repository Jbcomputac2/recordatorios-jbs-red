"use client";

import { useEffect, useMemo, useState } from "react";
import type { Item, Categoria } from "@/lib/types";
import { RECURRENCE_PRESETS, DAY_LABELS, DAY_CODES, DEFAULT_ACCIONES } from "@/lib/types";
import { parseEs } from "@/lib/nlp";

type Props = {
  item: Item | null;
  cats: Categoria[];
  onClose: () => void;
  onSave: (patch: Partial<Item>) => void;
  onDelete?: () => void;
};

export default function ReminderEditor({ item, cats, onClose, onSave, onDelete }: Props) {
  const isNew = item == null;
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [hora, setHora] = useState((item?.hora ?? "09:00:00").slice(0, 5));
  const [fechaInicio, setFechaInicio] = useState(item?.fecha_inicio ?? todayISO());
  const [categoriaId, setCategoriaId] = useState<number | null>(item?.categoria_id ?? cats[0]?.id ?? null);
  const [rrule, setRrule] = useState<string | null>(item?.rrule ?? null);
  const [byDay, setByDay] = useState<string[]>(parseByDay(item?.rrule));
  const [prioridad, setPrioridad] = useState(item?.prioridad ?? 4);
  const [clickUrl, setClickUrl] = useState(item?.click_url ?? "");
  const [acciones, setAcciones] = useState(item?.acciones ?? DEFAULT_ACCIONES);
  const [repetirCadaMin, setRepetirCadaMin] = useState<number | null>(item?.repetir_cada_min ?? null);

  const [nlText, setNlText] = useState("");
  const parsed = useMemo(() => isNew && nlText.trim() ? parseEs(nlText) : null, [isNew, nlText]);
  useEffect(() => {
    if (!parsed) return;
    // OJO: NO autocompletamos el titulo. El Profe escribe el suyo.
    setHora(parsed.hora);
    setFechaInicio(parsed.fecha_inicio);
    setRrule(parsed.rrule);
    setByDay(parseByDay(parsed.rrule));
  }, [parsed]);

  function pickPreset(id: string) {
    const p = RECURRENCE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setRrule(p.rrule);
    setByDay(parseByDay(p.rrule));
  }

  function toggleDay(code: string) {
    const next = byDay.includes(code) ? byDay.filter(d => d !== code) : [...byDay, code];
    const ordered = DAY_CODES.filter((d) => next.includes(d));
    setByDay([...ordered]);
    if (ordered.length === 0) setRrule(null);
    else if (ordered.length === 7) setRrule("FREQ=DAILY");
    else setRrule(`FREQ=WEEKLY;BYDAY=${ordered.join(",")}`);
  }

  const cat = cats.find((c) => c.id === categoriaId);

  function handleSave() {
    onSave({
      titulo: titulo || "Sin título",
      descripcion: descripcion || null,
      hora: hora + ":00",
      fecha_inicio: fechaInicio,
      categoria_id: categoriaId,
      rrule,
      prioridad,
      click_url: clickUrl || null,
      acciones,
      repetir_cada_min: repetirCadaMin,
    });
  }

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "0.5px solid var(--line)", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>Cancelar</button>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text)",
          }}>{isNew ? "Nuevo" : "Editar"}</div>
          <button onClick={handleSave} style={{ fontSize: 14, color: "var(--text)", fontWeight: 700 }}>Guardar</button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* NL input — only on new */}
          {isNew && (
            <div style={{
              padding: "12px 14px 14px", borderRadius: 12,
              background: "#000",
              color: "#fff",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                <Icon name="sparkle" size={11} /> Escribe rápido
              </div>
              <input
                autoFocus
                placeholder={'mañana 7am tomar pastilla'}
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
                style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 16, padding: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "#fff" }}
              />
              {parsed ? (
                <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.65)", fontFamily: "var(--font-mono)", letterSpacing: "-0.01em" }}>
                  → {fmtDate(fechaInicio)} · {hora}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-mono)", letterSpacing: "0.01em" }}>
                  o llena los campos abajo a mano ↓
                </div>
              )}
            </div>
          )}

          {/* Título + categoría picker */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, borderBottom: "0.5px solid var(--line)" }}>
            <CategoriaPickerCompact cats={cats} value={categoriaId} onChange={setCategoriaId} />
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontFamily: "var(--font-serif)", fontSize: 28, fontWeight: 400,
                letterSpacing: "-0.03em", lineHeight: 1.1,
              }}
            />
          </div>

          {/* Mensaje (descripcion) */}
          <div style={{ paddingBottom: 14, borderBottom: "0.5px solid var(--line)" }}>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Mensaje (opcional)"
              rows={2}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                fontFamily: "inherit", fontSize: 14, lineHeight: 1.45,
                color: "var(--text)", resize: "vertical", minHeight: 36,
                padding: 0,
              }}
            />
          </div>

          {/* Fecha + Hora */}
          <Section>
            <Row icon="calendar" label="Fecha">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={inputCompact} />
            </Row>
            <Divider />
            <Row icon="clock" label="Hora">
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={inputCompact} />
            </Row>
          </Section>

          {/* Repetir */}
          <Section pad>
            <SectionHeader icon="repeat" label="Repetir" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {RECURRENCE_PRESETS.map((p) => {
                const on = rrule === p.rrule;
                return (
                  <button key={p.id} onClick={() => pickPreset(p.id)} aria-pressed={on} style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: on ? "#000" : "transparent",
                    color: on ? "#fff" : "var(--text-soft)",
                    border: `0.5px solid ${on ? "#000" : "var(--line)"}`,
                  }}>{p.label}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "space-between" }}>
              {DAY_CODES.map((code, i) => {
                const on = byDay.includes(code);
                return (
                  <button key={code} onClick={() => toggleDay(code)} style={{
                    width: 34, height: 34, borderRadius: "50%",
                    background: on ? "#000" : "transparent",
                    color: on ? "#fff" : "var(--text-soft)",
                    fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                    border: `0.5px solid ${on ? "#000" : "var(--line)"}`,
                  }}>{DAY_LABELS[i]}</button>
                );
              })}
            </div>
          </Section>

          {/* Notificación */}
          <Section>
            <Row icon="bell" label="Prioridad">
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { v: 2, l: "Baja" },
                  { v: 3, l: "Normal" },
                  { v: 4, l: "Alta" },
                  { v: 5, l: "Urg" },
                ].map((p) => {
                  const on = prioridad === p.v;
                  return (
                    <button key={p.v} onClick={() => setPrioridad(p.v)} style={{
                      padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: on ? "#000" : "transparent",
                      color: on ? "#fff" : "var(--text-soft)",
                      border: `0.5px solid ${on ? "#000" : "var(--line)"}`,
                    }}>{p.l}</button>
                  );
                })}
              </div>
            </Row>
            <Divider />
            <Row icon="link" label="Abrir al tap">
              <input value={clickUrl} onChange={(e) => setClickUrl(e.target.value)}
                placeholder="opcional" style={inputCompact} />
            </Row>
          </Section>

          {/* Repetir hasta Hecho — alarm style */}
          <Section pad>
            <SectionHeader icon="alarm" label="Repetir hasta marcar Hecho" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[
                { v: null, l: "No" },
                { v: 5,    l: "5 min" },
                { v: 10,   l: "10 min" },
                { v: 15,   l: "15 min" },
                { v: 30,   l: "30 min" },
                { v: 60,   l: "1 hora" },
              ].map((p) => {
                const on = repetirCadaMin === p.v;
                return (
                  <button key={String(p.v)} onClick={() => setRepetirCadaMin(p.v)} style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: on ? "#000" : "transparent",
                    color: on ? "#fff" : "var(--text-soft)",
                    border: `0.5px solid ${on ? "#000" : "var(--line)"}`,
                  }}>{p.l}</button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Si activas esto, el recordatorio se enviará en bucle (cada X minutos) hasta que toques <strong style={{ color: "var(--text)", fontWeight: 600 }}>“Hecho”</strong> en la notificación.
            </div>
          </Section>

          {/* Sonido — info */}
          <Section pad>
            <SectionHeader icon="music" label="Sonido" />
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.55 }}>
              El sonido se elige en la <strong style={{ color: "var(--text)", fontWeight: 600 }}>app ntfy</strong> de tu celular:
            </div>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--text-soft)", lineHeight: 1.7 }}>
              <li>Abre ntfy → tu suscripción.</li>
              <li>Toca los 3 puntitos ⋮ → <em>Notification settings</em>.</li>
              <li>Elige el sonido o tono que quieras.</li>
            </ol>
            <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Tip: la <strong style={{ color: "var(--text)", fontWeight: 600 }}>prioridad Urgente</strong> ignora el modo silencio y vibra fuerte.
            </div>
          </Section>

          {/* Botones de notif */}
          <Section pad>
            <SectionHeader icon="zap" label="Botones en la notificación" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {acciones.map((a, i) => (
                <span key={i} style={{
                  padding: "5px 10px", background: "transparent",
                  border: "0.5px solid var(--line)",
                  borderRadius: 6, fontSize: 11, fontWeight: 600, color: "var(--text-soft)",
                }}>{a.label}</span>
              ))}
              {acciones.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin botones</span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.02em" }}>
              MÁX 3 BOTONES (LÍMITE NTFY)
            </div>
          </Section>

          {/* Eliminar */}
          {onDelete && (
            <button onClick={onDelete} style={{
              marginTop: 4, padding: "12px", borderRadius: 10,
              background: "transparent", border: "0.5px solid var(--line)",
              color: "var(--red)", fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em",
            }}>Eliminar recordatorio</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers UI ──────────────────────────────────────
function Section({ children, pad }: { children: React.ReactNode; pad?: boolean }) {
  return (
    <div style={{
      background: "var(--paper-2)", borderRadius: 12,
      padding: pad ? "14px 16px" : 0,
      display: "flex", flexDirection: "column",
      border: "0.5px solid var(--line)",
    }}>{children}</div>
  );
}
function SectionHeader({ icon, label }: { icon: IconName; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon name={icon} size={15} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>{label}</span>
    </div>
  );
}
function Row({ icon, label, children }: { icon: IconName; label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, minHeight: 46, flexShrink: 0 }}>
      <Icon name={icon} size={15} />
      <span style={{ fontSize: 13, color: "var(--text)", flex: 1, fontWeight: 500, letterSpacing: "-0.01em" }}>{label}</span>
      {children}
    </div>
  );
}
function Divider() { return <div style={{ height: 0.5, background: "var(--line)", marginLeft: 42 }} />; }

const inputCompact: React.CSSProperties = {
  background: "#fff", border: "0.5px solid var(--line)", borderRadius: 6,
  padding: "5px 9px", fontSize: 13, color: "var(--text)", outline: "none",
  minHeight: 30, flexShrink: 0, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
};

function CategoriaPickerCompact({ cats, value, onChange }: { cats: Categoria[]; value: number | null; onChange: (id: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const cur = cats.find((c) => c.id === value);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: 48, height: 48, borderRadius: 10,
        background: cur ? "#000" : "transparent",
        color: cur ? "#fff" : "var(--text-muted)",
        border: `0.5px solid ${cur ? "#000" : "var(--line)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <EmojiAsIcon emoji={cur?.emoji} size={20} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: 54, left: 0, zIndex: 5,
          background: "#fff", borderRadius: 10, padding: 6,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
          border: "0.5px solid var(--line)",
          display: "grid", gridTemplateColumns: "repeat(3, 64px)", gap: 4, width: 200,
        }}>
          {cats.map((c) => {
            const on = c.id === value;
            return (
              <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }} style={{
                padding: "10px 4px", borderRadius: 8,
                background: on ? "#000" : "transparent",
                color: on ? "#fff" : "var(--text)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <EmojiAsIcon emoji={c.emoji} size={16} />
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>{c.nombre}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── icons (Lucide-style outline) ───────────────────
type IconName = "calendar" | "clock" | "repeat" | "bell" | "music" | "link" | "zap" | "sparkle" | "alarm" | "pill" | "running" | "money" | "phone" | "cake" | "pin";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const c = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "calendar": return (<svg {...c}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>);
    case "clock":    return (<svg {...c}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>);
    case "repeat":   return (<svg {...c}><path d="M17 2l4 4-4 4M3 12v-2a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 12v2a4 4 0 0 1-4 4H3" /></svg>);
    case "bell":     return (<svg {...c}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 0 1-3.46 0" /></svg>);
    case "music":    return (<svg {...c}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>);
    case "link":     return (<svg {...c}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>);
    case "zap":      return (<svg {...c}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>);
    case "sparkle":  return (<svg {...c}><path d="M12 3l1.9 5.8L20 11l-6 2L12 21l-1.9-5.8L4 13l6-2 2-8z" /></svg>);
    case "alarm":    return (<svg {...c}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M5 3 2 6M19 3l3 3M7 21l-2 2M17 21l2 2" /></svg>);
    case "pill":     return (<svg {...c}><path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9l-9.9 9.9Z" /><path d="m9 14 6-6" /></svg>);
    case "running":  return (<svg {...c}><path d="M13 4a2 2 0 1 0 0-2 2 2 0 0 0 0 2zM6 17l3-3 2 4 4-3 3 5" /><path d="M4 22l3-7 4-2-3-5" /></svg>);
    case "money":    return (<svg {...c}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 10h5a2 2 0 1 1 0 4H9" /></svg>);
    case "phone":    return (<svg {...c}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>);
    case "cake":     return (<svg {...c}><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16h16M10 8a2 2 0 1 1 4 0c0 1.5-2 2-2 4M2 21h20" /></svg>);
    case "pin":      return (<svg {...c}><path d="M12 17v5M5 8l7 7 7-7M9 3l3 3 3-3" /></svg>);
  }
}

function EmojiAsIcon({ emoji, size = 16 }: { emoji?: string; size?: number }) {
  if (emoji === "💊") return <Icon name="pill" size={size} />;
  if (emoji === "📅") return <Icon name="calendar" size={size} />;
  if (emoji === "🏃") return <Icon name="running" size={size} />;
  if (emoji === "💰") return <Icon name="money" size={size} />;
  if (emoji === "📞") return <Icon name="phone" size={size} />;
  if (emoji === "🎂") return <Icon name="cake" size={size} />;
  return <Icon name="pin" size={size} />;
}

function parseByDay(rrule: string | null | undefined): string[] {
  if (!rrule) return [];
  if (rrule === "FREQ=DAILY") return [...DAY_CODES];
  const m = rrule.match(/BYDAY=([A-Z,]+)/);
  if (!m) return [];
  return m[1].split(",");
}
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(s: string) {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
}
