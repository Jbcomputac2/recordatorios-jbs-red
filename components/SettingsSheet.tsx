"use client";

import { useState } from "react";
import type { Settings } from "@/lib/types";

type Props = {
  settings: Settings;
  userEmail: string;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => Promise<void> | void;
};

const IA_INSTRUCCIONES = `Estás conectado a la API de Recordatorios del Profe. Sirve para crear, listar, editar y borrar recordatorios que disparan notificaciones push al celular del Profe vía ntfy.

ENDPOINT BASE: https://recuerdame.jbs.red/api/recordatorios
AUTH: Authorization: Bearer <API_TOKEN>   (te lo paso aparte)

──────────────────────────────────────────────
CREAR — POST /api/recordatorios
──────────────────────────────────────────────
Body JSON. Dos modos:

MODO A — lenguaje natural (lo más fácil):
{
  "texto": "mañana 7am tomar pastilla"
}

MODO B — estructurado (control total):
{
  "titulo":           "*  Lo que dirá la notificación",
  "fecha_inicio":     "*  YYYY-MM-DD",
  "hora":             "*  HH:MM (24h)",
  "rrule":            "   iCal RRULE o null (ej: 'FREQ=DAILY', 'FREQ=WEEKLY;BYDAY=MO,WE,FR')",
  "categoria_slug":   "   salud | trabajo | personal | finanzas | hogar | otros",
  "descripcion":      "   texto largo opcional",
  "prioridad":        3  (1=baja, 3=normal, 4=alta, 5=urgente),
  "click_url":        "   URL al tocar la notificación",
  "repetir_cada_min": null (o un número: si activo, la notif se repite cada X min hasta marcar Hecho)
}

Devuelve (201): { ok: true, recordatorio: {id, titulo, next_at, ...} }
Errores (400/401/500): { ok: false, error: "..." }

──────────────────────────────────────────────
LISTAR — GET /api/recordatorios
──────────────────────────────────────────────
Query params opcionales:
  ?limit=50          (default 100, max 500)
  ?activo=true       (solo activos) | ?activo=false (solo inactivos)

──────────────────────────────────────────────
EDITAR — PATCH /api/recordatorios/{id}
ELIMINAR — DELETE /api/recordatorios/{id}
──────────────────────────────────────────────
PATCH acepta cualquier campo del modo B para actualizar.
DELETE borra el recordatorio para siempre.

EJEMPLO curl:
curl -X POST https://recuerdame.jbs.red/api/recordatorios \\
  -H "Authorization: Bearer TU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "texto": "mañana 7am tomar pastilla" }'

⚠️ NOTAS:
- Si solo mando "texto", parseas con NLP y rellenas título/fecha/hora.
- Si no doy hora, default es 09:00.
- La zona horaria es America/Mexico_City siempre.
`;

export default function SettingsSheet({ settings, userEmail, onClose, onChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [copiedIA, setCopiedIA] = useState(false);
  const [sending, setSending] = useState(false);
  const subscribeUrl = `${settings.ntfy_url.replace(/\/+$/, "")}/${settings.ntfy_topic}`;

  function copyIA() {
    navigator.clipboard.writeText(IA_INSTRUCCIONES).then(() => {
      setCopiedIA(true); setTimeout(() => setCopiedIA(false), 2000);
    });
  }

  async function testPush() {
    setSending(true);
    try {
      await fetch(subscribeUrl, {
        method: "POST",
        headers: {
          "Title": "Prueba",
          "Priority": "5",
          "Tags": "bell",
        },
        body: "Si ves esto en tu celu, todo funciona.",
      });
    } finally { setSending(false); }
  }

  function copyTopic() {
    navigator.clipboard.writeText(subscribeUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="sheet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div style={{
          padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "0.5px solid var(--line)", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>Cerrar</button>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.12em", textTransform: "uppercase",
          }}>Ajustes</div>
          <span style={{ width: 56 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Cuenta */}
          <Block label="Cuenta">
            <div style={{ fontFamily: "var(--font-serif)", fontSize: 18, fontStyle: "italic", letterSpacing: "-0.02em" }}>{userEmail}</div>
            <form action="/auth/signout" method="post" style={{ marginTop: 10 }}>
              <button type="submit" style={{
                fontSize: 12, fontWeight: 600, color: "var(--red)",
                letterSpacing: "0.04em", textTransform: "uppercase",
              }}>→ Cerrar sesión</button>
            </form>
          </Block>

          {/* ntfy */}
          <Block label="Suscripción al celular">
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-soft)", lineHeight: 1.5 }}>
              Abre la app <strong style={{ fontWeight: 600 }}>ntfy</strong> en tu celular → ＋ → pega esta URL:
            </p>
            <div style={{
              padding: "10px 12px", background: "#fff", border: "0.5px solid var(--line)",
              borderRadius: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)",
              display: "flex", alignItems: "center", gap: 8, wordBreak: "break-all", letterSpacing: "-0.02em",
            }}>
              <span style={{ flex: 1 }}>{subscribeUrl}</span>
              <button onClick={copyTopic} style={{
                padding: "4px 10px", borderRadius: 5, background: "#000", color: "#fff",
                fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
              }}>{copied ? "Listo" : "Copiar"}</button>
            </div>
            <button onClick={testPush} disabled={sending} style={{
              marginTop: 14, padding: "12px", borderRadius: 10,
              background: "#000", color: "#fff",
              fontWeight: 600, fontSize: 13, width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: sending ? 0.6 : 1, letterSpacing: "-0.01em",
            }}>{sending ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "Enviar prueba"}</button>
          </Block>

          {/* IA externa */}
          <Block label="Instrucciones para IA externa">
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-soft)", lineHeight: 1.5 }}>
              Copia este bloque y pégalo en cualquier chat de IA (Claude, ChatGPT, etc.) para que pueda crear recordatorios en tu cuenta.
            </p>
            <div style={{
              padding: "10px 12px", background: "#fffbe6", border: "0.5px solid #e8d878",
              borderRadius: 8, fontSize: 11, color: "#5a4a08", lineHeight: 1.5, marginBottom: 12,
            }}>
              ⚠️ <strong style={{ fontWeight: 700 }}>El token NO está en este bloque por seguridad.</strong> Cuando le pases este instructivo a otra IA, también dale el valor de tu <code style={{ fontFamily: "var(--font-mono)" }}>API_TOKEN</code> (lo configuraste en EasyPanel → Environment). Sin token, la IA no puede crear nada.
            </div>
            <div style={{
              padding: "12px 14px", background: "#fafafa", border: "0.5px solid var(--line)",
              borderRadius: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)",
              maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5,
              letterSpacing: "-0.01em",
            }}>{IA_INSTRUCCIONES}</div>
            <button onClick={copyIA} style={{
              marginTop: 12, padding: "12px", borderRadius: 10,
              background: "#000", color: "#fff",
              fontWeight: 600, fontSize: 13, width: "100%",
              letterSpacing: "-0.01em",
            }}>{copiedIA ? "✓ Copiado" : "Copiar instrucciones"}</button>
          </Block>

          {/* Horas de silencio */}
          <Block label="Horas de silencio">
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, flex: 1, color: "var(--text-soft)" }}>Desde</span>
              <input type="time" defaultValue={settings.quiet_start ?? ""} onBlur={(e) => onChange({ quiet_start: e.target.value || null })}
                style={inputCompact} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, flex: 1, color: "var(--text-soft)" }}>Hasta</span>
              <input type="time" defaultValue={settings.quiet_end ?? ""} onBlur={(e) => onChange({ quiet_end: e.target.value || null })}
                style={inputCompact} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked={settings.quiet_carry} onChange={(e) => onChange({ quiet_carry: e.target.checked })} style={{ accentColor: "#000" }} />
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Reprogramar al terminar el silencio</span>
            </label>
          </Block>

          <div style={{
            padding: "16px 4px 4px", fontSize: 10, color: "var(--text-muted)",
            textAlign: "center", fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}>
            Recordatorios · v0.1
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--paper-2)", borderRadius: 12, padding: "16px 18px",
      border: "0.5px solid var(--line)",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: "var(--text-muted)", marginBottom: 12,
      }}>{label}</div>
      {children}
    </div>
  );
}

const inputCompact: React.CSSProperties = {
  background: "#fff", border: "0.5px solid var(--line)", borderRadius: 6,
  padding: "5px 9px", fontSize: 13, color: "var(--text)", outline: "none",
  fontFamily: "var(--font-mono)", letterSpacing: "-0.02em",
};
