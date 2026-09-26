"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

export function AccessInviteAcceptForm({
  token, identifier, signInMode, signedIn,
}: {
  token: string;
  identifier: string;
  signInMode: "email" | "username";
  signedIn: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function accept(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/creative-circle/access/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: signedIn ? undefined : name, password: signedIn ? undefined : password }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setBusy(false);
      setError(result.error ?? "Could not accept invitation.");
      return;
    }

    if (!signedIn) {
      const signIn = signInMode === "username"
        ? await authClient.signIn.username({ username: identifier.replace(/^@/, ""), password })
        : await authClient.signIn.email({ email: identifier, password });
      if (signIn.error) {
        setBusy(false);
        setError("Account created. Please sign in to continue.");
        return;
      }
    }

    router.push("/creative-circle");
    router.refresh();
  }

  return <form className="form-stack" onSubmit={accept}>
    {!signedIn && <>
      <div className="field"><label>Name</label><input className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}/></div>
      <div className="field"><label>Create password</label><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={12} maxLength={128}/><small className="muted">12 characters minimum.</small></div>
    </>}
    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn primary" disabled={busy}>{busy ? "JOINING…" : signedIn ? "ACCEPT INVITE ↘" : "CREATE ACCOUNT + ENTER ↘"}</button>
    {!signedIn && <p className="muted" style={{ fontSize: 11 }}>Already have an account?{" "}<Link href={`/creative-circle/login?next=${encodeURIComponent(`/creative-circle/access/invite/${token}`)}`} style={{ color: "var(--lime)" }}>Sign in first ↗</Link></p>}
  </form>;
}
