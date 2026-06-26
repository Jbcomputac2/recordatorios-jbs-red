"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const fn = mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });
      const { error } = await fn;
      if (error) throw error;
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message ?? "Algo salió mal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{
      minHeight: "100vh", display: "grid", placeItems: "center", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
            letterSpacing: "0.16em", textTransform: "uppercase",
            color: "var(--text-muted)", marginBottom: 12,
          }}>Recuérdame</div>
          <h1 style={{
            fontFamily: "var(--font-serif)", fontSize: 52, lineHeight: 0.95,
            letterSpacing: "-0.04em", margin: "0 0 14px", fontWeight: 400,
          }}>
            {mode === "signin" ? <>Hola de<br /><em style={{ fontStyle: "italic" }}>nuevo.</em></> : <>Crea tu<br /><em style={{ fontStyle: "italic" }}>cuenta.</em></>}
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
            {mode === "signin" ? "Inicia sesión para continuar" : "Configura tu acceso"}
          </div>
        </div>

        <form onSubmit={onSubmit} style={{
          display: "grid", gap: 10,
        }}>
          <Label>Correo</Label>
          <input
            type="email" autoComplete="email" required
            placeholder="tu@correo.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <div style={{ height: 4 }} />
          <Label>Contraseña</Label>
          <input
            type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required minLength={6} placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: 8, fontSize: 12,
              background: "rgba(179,38,30,0.06)", color: "var(--red)",
              border: "0.5px solid rgba(179,38,30,0.2)",
              fontFamily: "var(--font-mono)", letterSpacing: "-0.01em",
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            marginTop: 8, padding: "14px", borderRadius: 10,
            background: "#000", color: "#fff", fontWeight: 600, fontSize: 14,
            letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : (mode === "signin" ? "Entrar →" : "Crear cuenta →")}
          </button>
        </form>

        <div style={{ marginTop: 26, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          {mode === "signin" ? (
            <>¿Primera vez?{" "}<button onClick={() => setMode("signup")} style={{ color: "var(--text)", fontWeight: 600, borderBottom: "1px solid var(--text)" }}>Crear cuenta</button></>
          ) : (
            <>¿Ya tienes?{" "}<button onClick={() => setMode("signin")} style={{ color: "var(--text)", fontWeight: 600, borderBottom: "1px solid var(--text)" }}>Entrar</button></>
          )}
        </div>
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      letterSpacing: "0.1em", textTransform: "uppercase",
      color: "var(--text-muted)", marginBottom: -2,
    }}>{children}</div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 8,
  background: "var(--paper)", border: "0.5px solid var(--line)",
  fontSize: 15, color: "var(--text)", outline: "none",
  letterSpacing: "-0.01em",
};
