"use client";
import { FormEvent, useState } from "react";
import { authClient } from "@/src/lib/auth-client";

export function LoginForm({ nextPath = "/creative-circle" }: { nextPath?: string }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const value = identifier.trim();
    const result = value.includes("@")
      ? await authClient.signIn.email({ email: value.toLowerCase(), password })
      : await authClient.signIn.username({ username: value, password });

    if (result.error) {
      setBusy(false);
      const message = result.error.message ?? "Sign in failed";
      setError(message.toLowerCase().includes("invalid origin")
        ? `${message} — ${window.location.origin}`
        : message);
      return;
    }

    // Use a full document navigation after auth. This avoids stale App Router
    // state on mobile browsers and guarantees the server sees the newly-set
    // session cookie on the next request.
    window.location.assign(nextPath);
  }

  return <form className="form-stack" onSubmit={submit}>
    <div className="field">
      <label>Email or username</label>
      <input className="input" type="text" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required/>
    </div>
    <div className="field">
      <label>Password</label>
      <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12}/>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn primary" disabled={busy}>{busy ? "SIGNING IN…" : "ENTER CREATIVE CIRCLE ↘"}</button>
  </form>;
}
