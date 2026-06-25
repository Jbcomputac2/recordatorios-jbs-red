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
  const [hora, setHora] = useState((item?.hora ?? "09:00:00").slice(0, 5));
  const [fechaInicio, setFechaInicio] = useState(item?.fecha_inicio ?? todayISO());
  const [categoriaId, setCategoriaId] = useState<number | null>(item?.categoria_id ?? cats[0]?.id ?? null);
  const [rrule, setRrule] = useState<string | null>(item?.rrule ?? null);
  const [byDay, setByDay] = useState<string[]>(parseByDay(item?.rrule));
  const [prioridad, setPrioridad] = useState(item?.prioridad ?? 4);
  const [clickUrl, setClickUrl] = useState(item?.click_url ?? "");
  const [acciones, setAcciones] = useState(item?.acciones ?? DEFAULT_ACCIONES);

  // ─── parser de lenguaje natural (solo en "nuevo") ─
  const [nlText, setNlText] = useState("");
  const parsed = useMemo(() => isNew && nlText.trim() ? parseEs(nlText) : null, [isNew, nlText]);
  useEffect(() => {
    if (!parsed) return;
    setTitulo(parsed.titulo);
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
      hora: hora + ":00",
      fecha_inicio: fechaInicio,
      categoria_id: categoriaId,
      rrule,
      prioridad,
      click_url: clickUrl || null,
      acciones,
    });
  }

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "0.5px solid var(--border-2)", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{ color: "var(--accent)", fontSize: 15 }}>Cancelar</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{isNew ? "Nuevo recordatorio" : "Editar"}</div>
          <button onClick={handleSave} style={{ color: "var(--accent)", fontWeight: 600, fontSize: 15 }}>Guardar</button>
        </div>

        <div style={{ overflowY: "auto", padding: "14px 16px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* NL input (solo nuevo) */}
          {isNew && (
            <div style={{
              padding: "14px 16px", borderRadius: 16,
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,.04), 0 6px 20px rgba(0,0,0,.04)",
              border: "1px solid var(--border-2)",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg, #007aff, #af52de)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                  fontSize: 14, flexShrink: 0,
                }}>✦</div>
                <input
                  autoFocus
                  placeholder={'p.ej. "mañana 7am tomar pastilla"'}
                  value={nlText}
                  onChange={(e) => setNlText(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 16, padding: "4px 0" }}
                />
              </div>
              {parsed && (
                <div style={{
                  marginTop: 10, padding: "6px 10px", background: "#f0f9ff", borderRadius: 8,
                  fontSize: 12, color: "#0071e3",
                }}>
                  ✓ Lo entendí como: <strong>{titulo}</strong> · {fmtDate(fechaInicio)} · {hora}
                </div>
              )}
            </div>
          )}

          {/* Título */}
          <Section>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
              <CategoriaPickerCompact cats={cats} value={categoriaId} onChange={setCategoriaId} />
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 17, fontWeight: 600 }}
              />
            </div>
          </Section>

          {/* Fecha + Hora */}
          <Section>
            <Row icon="📅" label="Fecha">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                     style={inputCompact} />
            </Row>
            <Divider />
            <Row icon="🕐" label="Hora">
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)}
                     style={inputCompact} />
            </Row>
          </Section>

          {/* Recurrencia */}
          <Section pad>
            <SectionHeader icon="🔁" label="Repetir" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {RECURRENCE_PRESETS.map((p) => (
                <button key={p.id}
                  onClick={() => pickPreset(p.id)}
                  aria-pressed={rrule === p.rrule}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                    background: rrule === p.rrule ? "var(--accent)" : "#fff",
                    color: rrule === p.rrule ? "#fff" : "var(--text-soft)",
                    border: `1px solid ${rrule === p.rrule ? "var(--accent)" : "var(--border)"}`,
                  }}>{p.label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 12, justifyContent: "space-between" }}>
              {DAY_CODES.map((code, i) => {
                const on = byDay.includes(code);
                return (
                  <button key={code} onClick={() => toggleDay(code)} style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: on ? "var(--accent)" : "#f5f5f7",
                    color: on ? "#fff" : "var(--text-soft)",
                    fontSize: 12, fontWeight: 700,
                  }}>{DAY_LABELS[i]}</button>
                );
              })}
            </div>
          </Section>

          {/* Notificación */}
          <Section>
            <Row icon="🔔" label="Prioridad">
              <div style={{ display: "flex", gap: 4 }}>
                {[
                  { v: 2, l: "Baja"   },
                  { v: 3, l: "Normal" },
                  { v: 4, l: "Alta"   },
                  { v: 5, l: "Urg!"   },
                ].map((p) => (
                  <button key={p.v} onClick={() => setPrioridad(p.v)}
                    style={{
                      padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                      background: prioridad === p.v ? (p.v >= 5 ? "var(--red)" : p.v === 4 ? "var(--orange)" : "var(--accent)") : "#e8e8ed",
                      color: prioridad === p.v ? "#fff" : "var(--text-soft)",
                    }}>{p.l}</button>
                ))}
              </div>
            </Row>
            <Divider />
            <Row icon="🎵" label="Sonido">
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                {cat?.sonido ?? "default"} <span style={{ color: "var(--text-tertiary)", marginLeft: 4 }}>(de categoría)</span>
              </span>
            </Row>
            <Divider />
            <Row icon="🔗" label="Abrir al tap">
              <input value={clickUrl} onChange={(e) => setClickUrl(e.target.value)}
                placeholder="opcional (ej. zoom.us/…)" style={inputCompact} />
            </Row>
          </Section>

          {/* Botones de notif */}
          <Section pad>
            <SectionHeader icon="⚡" label="Botones en la notificación" />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {acciones.map((a, i) => (
                <span key={i} style={{
                  padding: "5px 10px", background: "#fff", border: "1px solid var(--border)",
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: a.kind === "done" ? "var(--green)" : a.kind === "snooze" ? "var(--orange)" : "var(--accent)",
                }}>{a.label}</span>
              ))}
              {acciones.length === 0 && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sin botones</span>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              Máximo 3 botones por notificación (limite de ntfy).
            </div>
          </Section>

          {/* Eliminar */}
          {onDelete && (
            <button onClick={onDelete} style={{
              marginTop: 4, padding: "12px", borderRadius: 12,
              background: "#fff", border: "1px solid var(--border)",
              color: "var(--red)", fontWeight: 600, fontSize: 15,
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
      background: "#fafafa", borderRadius: 14, overflow: "hidden",
      padding: pad ? "12px 14px" : 0,
    }}>{children}</div>
  );
}
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{label}</span>
    </div>
  );
}
function Row({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 14, color: "var(--text)", flex: 1 }}>{label}</span>
      {children}
    </div>
  );
}
function Divider() { return <div style={{ height: 0.5, background: "var(--border-2)", marginLeft: 42 }} />; }

const inputCompact: React.CSSProperties = {
  background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
  padding: "5px 9px", fontSize: 14, color: "var(--text)", outline: "none",
};

function CategoriaPickerCompact({ cats, value, onChange }: { cats: Categoria[]; value: number | null; onChange: (id: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const cur = cats.find((c) => c.id === value);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{
        width: 44, height: 44, borderRadius: 12,
        background: cur ? `linear-gradient(135deg, ${cur.color}, ${cur.color}aa)` : "#e5e5ea",
        boxShadow: cur ? `0 4px 10px ${cur.color}55` : "none",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
      }}>{cur?.emoji ?? "📌"}</button>
      {open && (
        <div style={{
          position: "absolute", top: 50, left: 0, zIndex: 5,
          background: "#fff", borderRadius: 12, padding: 6,
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)", display: "flex", flexWrap: "wrap",
          gap: 4, width: 220,
        }}>
          {cats.map((c) => (
            <button key={c.id} onClick={() => { onChange(c.id); setOpen(false); }} style={{
              width: 60, padding: "8px 4px", borderRadius: 8,
              background: c.id === value ? `${c.color}22` : "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <span style={{ fontSize: 22 }}>{c.emoji}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.color }}>{c.nombre}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
