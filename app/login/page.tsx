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
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, margin: "0 auto 16px",
            borderRadius: 18, background: "linear-gradient(135deg, #ff2d55, #af52de)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 32px rgba(255,45,85,0.35)", fontSize: 36,
          }}>🔔</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em", color: "var(--text)" }}>
            Recordatorios del Profe
          </h1>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            {mode === "signin" ? "Inicia sesión para entrar" : "Crea tu cuenta"}
          </div>
        </div>

        <form onSubmit={onSubmit} style={{
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.8)",
          borderRadius: 18, padding: 20,
          boxShadow: "var(--shadow-card)",
          display: "grid", gap: 12,
        }}>
          <input
            type="email" autoComplete="email" required
            placeholder="tu@correo.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required minLength={6} placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: 10, fontSize: 13,
              background: "rgba(255,59,48,0.10)", color: "var(--red)",
            }}>{error}</div>
          )}
          <button type="submit" disabled={loading} style={{
            padding: "12px", borderRadius: 12,
            background: "linear-gradient(135deg, #007aff, #5856d6)",
            color: "#fff", fontWeight: 600, fontSize: 15,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? <span className="spinner" style={{ borderTopColor: "#fff" }} /> : (mode === "signin" ? "Entrar" : "Crear cuenta")}
          </button>
        </form>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
          {mode === "signin" ? (
            <>¿Primera vez? <button onClick={() => setMode("signup")} style={{ color: "var(--accent)", fontWeight: 500 }}>Crear cuenta</button></>
          ) : (
            <>¿Ya tienes? <button onClick={() => setMode("signin")} style={{ color: "var(--accent)", fontWeight: 500 }}>Entrar</button></>
          )}
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  background: "#f5f5f7", border: "1px solid transparent",
  fontSize: 15, color: "var(--text)", outline: "none",
};
