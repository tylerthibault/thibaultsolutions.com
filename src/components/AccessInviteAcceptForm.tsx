"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";

export function AccessInviteAcceptForm({
  token,
  email,
  signedInEmail,
}: {
  token: string;
  email: string;
  signedInEmail: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const matchingSession = signedInEmail?.toLowerCase() === email.toLowerCase();

  async function accept(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/creative-circle/access/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: signedInEmail ? undefined : name,
        password: signedInEmail ? undefined : password,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setBusy(false);
      setError(result.error ?? "Could not accept invitation.");
      return;
    }

    if (!signedInEmail) {
      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.error) {
        setBusy(false);
        setError("Account created. Please sign in to continue.");
        return;
      }
    }

    router.push("/creative-circle");
    router.refresh();
  }

  if (signedInEmail && !matchingSession) {
    return <div className="error">
      You are signed in as {signedInEmail}, but this invite is for {email}. Sign out and reopen this link with the invited account.
    </div>;
  }

  return <form className="form-stack" onSubmit={accept}>
    {!signedInEmail && <>
      <div className="field">
        <label>Name</label>
        <input className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80}/>
      </div>
      <div className="field">
        <label>Create password</label>
        <input className="input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} maxLength={128}/>
        <small className="muted">12 characters minimum.</small>
      </div>
    </>}

    {error && <div className="error" role="alert">{error}</div>}
    <button className="btn primary" disabled={busy}>
      {busy ? "JOINING…" : signedInEmail ? "ACCEPT INVITE ↘" : "CREATE ACCOUNT + ENTER ↘"}
    </button>

    {!signedInEmail && <p className="muted" style={{ fontSize: 11 }}>
      Already have an account with this email?{" "}
      <Link
        href={`/creative-circle/login?next=${encodeURIComponent(`/creative-circle/access/invite/${token}`)}`}
        style={{ color: "var(--lime)" }}
      >
        Sign in first ↗
      </Link>
    </p>}
  </form>;
}
