"use client";

import { FormEvent, useState } from "react";

type Member = { userId: string; name: string; email: string; createdAt: string | Date };
type Pending = { id: string; email: string; expiresAt: string | Date; createdAt: string | Date };

export function ReviewersPanel({ initialMembers, initialPending }: { initialMembers: Member[]; initialPending: Pending[] }) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [pending, setPending] = useState<Pending[]>(initialPending);
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await fetch("/api/feedback/invitations", { cache: "no-store" });
    if (!response.ok) return;
    const result = await response.json();
    setMembers(result.members ?? []);
    setPending(result.pending ?? []);
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setInviteUrl("");
    setMessage("");
    const response = await fetch("/api/feedback/invitations", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(result.error ?? "Could not create invite."); return; }
    if (result.memberAdded) {
      setMessage(`${result.member.name} already had an account and was added to your circle.`);
    } else {
      setInviteUrl(result.inviteUrl);
      setMessage("Invite created. Send this one-time link to them.");
    }
    setEmail("");
    await reload();
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage("Invite link copied.");
  }

  return <div className="feedback-manage-grid">
    <section className="cc-panel">
      <span className="micro muted">INVITE A REVIEWER</span>
      <form className="form-stack" onSubmit={invite} style={{ marginTop: 18 }}>
        <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required/></div>
        <button className="btn primary" disabled={busy}>{busy ? "CREATING INVITE…" : "CREATE PRIVATE INVITE ↘"}</button>
      </form>
      {message && <p className={inviteUrl ? "success" : "muted"} style={{ marginTop: 16 }}>{message}</p>}
      {inviteUrl && <div className="invite-link-box"><code>{inviteUrl}</code><button className="btn" onClick={copy}>COPY LINK</button></div>}
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>For now, the invite link is generated here for you to send. Automatic email delivery can be added after the review workflow is proven out.</p>
    </section>
    <section className="cc-panel">
      <span className="micro muted">ACTIVE REVIEWERS</span>
      <div className="reviewer-list">{members.length ? members.map((member) => <div className="reviewer-row" key={member.userId}><div><b>{member.name}</b><small>{member.email}</small></div><span className="micro" style={{ color: "var(--lime)" }}>ACTIVE</span></div>) : <p className="muted">No reviewers yet.</p>}</div>
      {pending.length > 0 && <><span className="micro muted" style={{ display: "block", marginTop: 28 }}>PENDING INVITES</span><div className="reviewer-list">{pending.map((item) => <div className="reviewer-row" key={item.id}><div><b>{item.email}</b><small>Expires {new Date(item.expiresAt).toLocaleDateString()}</small></div><span className="micro" style={{ color: "var(--cyan)" }}>PENDING</span></div>)}</div></>}
    </section>
  </div>;
}
