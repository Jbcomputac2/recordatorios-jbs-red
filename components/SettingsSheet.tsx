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
  const ntfyAppUrl = `https://ntfy.sh/${settings.ntfy_topic}`;
  const subscribeUrl = `${settings.ntfy_url.replace(/\/+$/, "")}/${settings.ntfy_topic}`;

  async function testPush() {
    setSending(true);
    try {
      await fetch(`${settings.ntfy_url.replace(/\/+$/, "")}/${settings.ntfy_topic}`, {
        method: "POST",
        headers: {
          "Title": "🔔 Prueba — Recordatorios del Profe",
          "Priority": "5",
          "Tags": "bell",
        },
        body: "Si ves esto en tu celu, ¡todo funciona!",
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
          padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "0.5px solid var(--border-2)", flexShrink: 0,
        }}>
          <button onClick={onClose} style={{ color: "var(--accent)", fontSize: 15 }}>Cerrar</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ajustes</div>
          <span style={{ width: 56 }} />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Cuenta */}
          <div style={{ background: "#fafafa", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, marginBottom: 6 }}>Cuenta</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{userEmail}</div>
            <form action="/auth/signout" method="post" style={{ marginTop: 10 }}>
              <button type="submit" style={{ color: "var(--red)", fontSize: 14, fontWeight: 500 }}>Cerrar sesión</button>
            </form>
          </div>

          {/* ntfy */}
          <div style={{ background: "#fafafa", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, marginBottom: 8 }}>📲 Suscribirte desde el celular</div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-soft)", lineHeight: 1.5 }}>
              Abre la app de <strong>ntfy</strong> en tu celular → ＋ → pega esta URL:
            </p>
            <div style={{
              padding: "10px 12px", background: "#fff", border: "1px solid var(--border)",
              borderRadius: 10, fontFamily: "ui-monospace, monospace", fontSize: 12, color: "var(--text)",
              display: "flex", alignItems: "center", gap: 8, wordBreak: "break-all",
            }}>
              <span style={{ flex: 1 }}>{subscribeUrl}</span>
              <button onClick={copyTopic} style={{
                padding: "4px 10px", borderRadius: 6, background: "var(--accent)", color: "#fff",
                fontSize: 11, fontWeight: 600,
              }}>{copied ? "✓" : "Copiar"}</button>
            </div>
            <button onClick={testPush} disabled={sending} style={{
              marginTop: 12, padding: "10px 14px", borderRadius: 12,
              background: "linear-gradient(135deg, #007aff, #5856d6)", color: "#fff",
              fontWeight: 600, fontSize: 14, width: "100%",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              opacity: sending ? 0.7 : 1,
            }}>{sending ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : "🔔 Enviar prueba"}</button>
          </div>

          {/* Horas de silencio */}
          <div style={{ background: "#fafafa", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 600, marginBottom: 10 }}>🌙 Horas de silencio</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, flex: 1 }}>Desde</span>
              <input type="time" defaultValue={settings.quiet_start ?? ""} onBlur={(e) => onChange({ quiet_start: e.target.value || null })}
                style={{ padding: "5px 9px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 14, flex: 1 }}>Hasta</span>
              <input type="time" defaultValue={settings.quiet_end ?? ""} onBlur={(e) => onChange({ quiet_end: e.target.value || null })}
                style={{ padding: "5px 9px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 14 }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked={settings.quiet_carry} onChange={(e) => onChange({ quiet_carry: e.target.checked })} />
              <span style={{ fontSize: 13, color: "var(--text-soft)" }}>Reprogramar al terminar el silencio</span>
            </label>
          </div>

          <div style={{ padding: "0 4px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
            Recordatorios del Profe · v0.1
          </div>
        </div>
      </div>
    </div>
  );
}
