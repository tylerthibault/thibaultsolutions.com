"use client";

import { FormEvent, useMemo, useState } from "react";

type AccessUser = {
  id: string;
  name: string;
  email: string;
  labAccess: boolean;
  feedbackAccess: boolean;
  isAdmin: boolean;
  createdAt: string;
};

type PendingInvite = {
  id: string;
  email: string;
  labAccess: boolean;
  feedbackAccess: boolean;
  expiresAt: string;
  createdAt: string;
};

export function AccessAdminPanel({ initialUsers, initialInvites }: { initialUsers: AccessUser[]; initialInvites: PendingInvite[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLab, setInviteLab] = useState(true);
  const [inviteFeedback, setInviteFeedback] = useState(true);
  const [inviteUrl, setInviteUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
  }, [query, users]);

  const activeCount = users.filter((user) => user.isAdmin || user.labAccess || user.feedbackAccess).length;

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (!inviteLab && !inviteFeedback) {
      setMessage("Choose at least one section for the invitation.");
      return;
    }

    setInviting(true);
    setMessage("");
    setInviteUrl("");

    const response = await fetch("/api/creative-circle/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, labAccess: inviteLab, feedbackAccess: inviteFeedback }),
    });
    const result = await response.json().catch(() => ({}));
    setInviting(false);

    if (!response.ok) {
      setMessage(result.error ?? "Could not create invitation.");
      return;
    }

    if (result.memberAdded) {
      setUsers((current) => current.map((user) => user.id === result.account.id
        ? { ...user, labAccess: result.account.labAccess, feedbackAccess: result.account.feedbackAccess }
        : user));
      setInvites((current) => current.filter((item) => item.email.toLowerCase() !== result.account.email.toLowerCase()));
      setMessage(`${result.account.email} already had an account. The selected section access is now enabled.`);
    } else {
      setInvites((current) => [result.invitation, ...current.filter((item) => item.email.toLowerCase() !== result.invitation.email.toLowerCase())]);
      setInviteUrl(result.inviteUrl);
      setMessage("Invite created. Send the private link to the member.");
    }

    setInviteEmail("");
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage("Invite link copied.");
    } catch {
      setMessage("Copy the invite link manually.");
    }
  }

  async function cancelInvite(id: string) {
    setBusyId(id);
    setMessage("");
    const response = await fetch("/api/creative-circle/admin/invitations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(result.error ?? "Could not cancel invitation.");
      return;
    }
    setInvites((current) => current.filter((invite) => invite.id !== id));
    setMessage("Invitation cancelled.");
  }

  async function updateAccess(userId: string, changes: { labAccess?: boolean; feedbackAccess?: boolean }) {
    setBusyId(userId);
    setMessage("");
    const response = await fetch("/api/creative-circle/admin/access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...changes }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      setMessage(result.error ?? "Could not update access.");
      return;
    }

    setUsers((current) => current.map((user) => user.id === userId
      ? { ...user, labAccess: result.user.labAccess, feedbackAccess: result.user.feedbackAccess }
      : user));
    setMessage("Section access updated.");
  }

  return <div className="access-admin-stack">
    <section className="cc-panel access-invite-panel">
      <div>
        <span className="micro muted">INVITE MEMBER</span>
        <h2>CHOOSE THEIR SECTIONS.</h2>
        <p className="muted">Select exactly what this member should be able to use. You can change either section at any time after they join.</p>
      </div>

      <form className="access-invite-form access-invite-form-sections" onSubmit={invite}>
        <input className="input" type="email" placeholder="member@example.com" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} required/>
        <div className="access-section-picker" aria-label="Sections to grant">
          <label className={inviteLab ? "access-section-choice selected" : "access-section-choice"}>
            <input type="checkbox" checked={inviteLab} onChange={(event) => setInviteLab(event.target.checked)}/>
            <span><b>VIDEO LAB</b><small>Effects, projects, renders + exports</small></span>
          </label>
          <label className={inviteFeedback ? "access-section-choice selected" : "access-section-choice"}>
            <input type="checkbox" checked={inviteFeedback} onChange={(event) => setInviteFeedback(event.target.checked)}/>
            <span><b>FEEDBACK LAB</b><small>Watch assigned videos + leave comments</small></span>
          </label>
        </div>
        <button className="btn primary" disabled={inviting || (!inviteLab && !inviteFeedback)}>
          {inviting ? "CREATING…" : "CREATE INVITE ↘"}
        </button>
      </form>

      {inviteUrl && <div className="access-invite-link">
        <input className="input" value={inviteUrl} readOnly aria-label="Private invitation link"/>
        <button className="btn" type="button" onClick={copyInvite}>COPY LINK</button>
      </div>}

      {message && <div className="muted access-admin-message">{message}</div>}

      {invites.length > 0 && <div className="access-pending">
        <span className="micro muted">PENDING INVITES</span>
        {invites.map((invite) => <div className="access-pending-row" key={invite.id}>
          <div>
            <strong>{invite.email}</strong>
            <div className="access-mini-pills">
              {invite.labAccess && <span>VIDEO LAB</span>}
              {invite.feedbackAccess && <span>FEEDBACK</span>}
            </div>
            <small>Expires {new Date(invite.expiresAt).toLocaleDateString()}</small>
          </div>
          <button className="tiny-btn" type="button" disabled={busyId === invite.id} onClick={() => cancelInvite(invite.id)}>
            {busyId === invite.id ? "CANCELLING…" : "CANCEL INVITE"}
          </button>
        </div>)}
      </div>}
    </section>

    <section className="cc-panel access-admin-panel">
      <div className="access-admin-summary">
        <div>
          <span className="micro muted">MEMBER ACCESS</span>
          <strong>{activeCount} ACTIVE / {users.length} TOTAL</strong>
        </div>
        <input className="input access-admin-search" type="search" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)}/>
      </div>

      <div className="access-admin-list">
        {filtered.map((user) => {
          const hasAny = user.isAdmin || user.labAccess || user.feedbackAccess;
          return <div className="access-admin-row access-admin-row-sections" key={user.id}>
            <div className="access-admin-person">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>Joined {new Date(user.createdAt).toLocaleDateString()}</small>
            </div>
            <div className="member-section-controls">
              {user.isAdmin ? <span className="access-status on">ADMIN / BOTH SECTIONS</span> : <>
                <button className={user.labAccess ? "section-access-btn enabled" : "section-access-btn"} type="button" disabled={busyId === user.id} onClick={() => updateAccess(user.id, { labAccess: !user.labAccess })}>
                  <span>VIDEO LAB</span><b>{user.labAccess ? "ON" : "OFF"}</b>
                </button>
                <button className={user.feedbackAccess ? "section-access-btn enabled" : "section-access-btn"} type="button" disabled={busyId === user.id} onClick={() => updateAccess(user.id, { feedbackAccess: !user.feedbackAccess })}>
                  <span>FEEDBACK LAB / COMMENTER</span><b>{user.feedbackAccess ? "ON" : "OFF"}</b>
                </button>
                {hasAny && <button className="tiny-btn remove-all-access" type="button" disabled={busyId === user.id} onClick={() => updateAccess(user.id, { labAccess: false, feedbackAccess: false })}>REMOVE ALL</button>}
              </>}
            </div>
          </div>;
        })}
        {filtered.length === 0 && <p className="muted" style={{ padding: 18 }}>No accounts match that search.</p>}
      </div>
    </section>
  </div>;
}
