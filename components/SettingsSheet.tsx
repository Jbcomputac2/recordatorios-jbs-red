"use client";

import { useState } from "react";
import type { Settings } from "@/lib/types";

type Props = {
  settings: Settings;
  userEmail: string;
  onClose: () => void;
  onChange: (patch: Partial<Settings>) => Promise<void> | void;
};

export default function SettingsSheet({ settings, userEmail, onClose, onChange }: Props) {
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const subscribeUrl = `${settings.ntfy_url.replace(/\/+$/, "")}/${settings.ntfy_topic}`;

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
