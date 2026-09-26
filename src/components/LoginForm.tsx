"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

export function LoginForm({ nextPath = "/creative-circle" }: { nextPath?: string }) {
  const router = useRouter();
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

    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "Sign in failed");
      return;
    }
    router.push(nextPath);
    router.refresh();
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
