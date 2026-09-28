"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/creative-circle/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, pin }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Could not create account.");
        return;
      }

      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.error) {
        setError("Account created. Please return to sign in.");
        return;
      }

      router.push("/creative-circle");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <form className="form-stack" onSubmit={submit}>
    <div className="field">
      <label>Name</label>
      <input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}/>
    </div>
    <div className="field">
      <label>Email</label>
      <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required/>
    </div>
    <div className="field">
      <label>Password</label>
      <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128}/>
      <small className="muted">12 characters minimum.</small>
    </div>
    <div className="field">
      <label>Access PIN</label>
      <input className="input" type="password" inputMode="numeric" autoComplete="one-time-code" value={pin} onChange={(e) => setPin(e.target.value)} required minLength={4} maxLength={128}/>
    </div>
    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn primary" disabled={busy}>{busy ? "CREATING ACCOUNT…" : "CREATE ACCOUNT ↘"}</button>
  </form>;
}
