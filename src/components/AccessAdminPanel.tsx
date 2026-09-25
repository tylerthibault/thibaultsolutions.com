"use client";

import { FormEvent, useMemo, useState } from "react";

type AccessUser = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  isAdmin: boolean;
  createdAt: string;
};

type PendingInvite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export function AccessAdminPanel({
  initialUsers,
  initialInvites,
}: {
  initialUsers: AccessUser[];
  initialInvites: PendingInvite[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [invites, setInvites] = useState(initialInvites);
  const [query, setQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
  }, [query, users]);

  const activeCount = users.filter((user) => user.enabled || user.isAdmin).length;

  async function invite(event: FormEvent) {
    event.preventDefault();
    setInviting(true);
    setMessage("");
    setInviteUrl("");

    const response = await fetch("/api/creative-circle/admin/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail }),
    });
    const result = await response.json().catch(() => ({}));
    setInviting(false);

    if (!response.ok) {
      setMessage(result.error ?? "Could not create invitation.");
      return;
    }

    if (result.memberAdded) {
      setUsers((current) => current.map((user) => user.id === result.account.id
        ? { ...user, enabled: true }
        : user));
      setInvites((current) => current.filter((item) => item.email.toLowerCase() !== result.account.email.toLowerCase()));
      setMessage(`${result.account.email} already had an account. Access is now enabled.`);
    } else {
      setInvites((current) => [
        result.invitation,
        ...current.filter((item) => item.email.toLowerCase() !== result.invitation.email.toLowerCase()),
      ]);
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

  async function setAccess(userId: string, enabled: boolean) {
    setBusyId(userId);
    setMessage("");
    const response = await fetch("/api/creative-circle/admin/access", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, enabled }),
    });
    const result = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      setMessage(result.error ?? "Could not update access.");
      return;
    }

    setUsers((current) => current.map((user) => user.id === userId ? {
      ...user,
      enabled: result.user.creativeCircleAccess,
    } : user));
    setMessage(enabled ? "Access enabled." : "Access removed.");
  }

  return <div className="access-admin-stack">
    <section className="cc-panel access-invite-panel">
      <div>
        <span className="micro muted">INVITE MEMBER</span>
        <h2>ADD SOMEONE TO THE CIRCLE.</h2>
        <p className="muted">If they already have an account, access turns on immediately. Otherwise you get a private one-time signup link.</p>
      </div>
      <form className="access-invite-form" onSubmit={invite}>
        <input
          className="input"
          type="email"
          placeholder="member@example.com"
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
          required
        />
        <button className="btn primary" disabled={inviting}>
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
        <input
          className="input access-admin-search"
          type="search"
          placeholder="Search name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="access-admin-list">
        {filtered.map((user) => {
          const enabled = user.enabled || user.isAdmin;
          return <div className="access-admin-row" key={user.id}>
            <div className="access-admin-person">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
              <small>Joined {new Date(user.createdAt).toLocaleDateString()}</small>
            </div>
            <div className="access-admin-controls">
              <span className={enabled ? "access-status on" : "access-status off"}>
                {user.isAdmin ? "ADMIN" : enabled ? "ACCESS ON" : "ACCESS OFF"}
              </span>
              {!user.isAdmin && <button
                className={enabled ? "btn" : "btn primary"}
                type="button"
                disabled={busyId === user.id}
                onClick={() => setAccess(user.id, !enabled)}
              >
                {busyId === user.id ? "SAVING…" : enabled ? "REMOVE ACCESS" : "ENABLE ACCESS"}
              </button>}
            </div>
          </div>;
        })}
        {filtered.length === 0 && <p className="muted" style={{ padding: 18 }}>No accounts match that search.</p>}
      </div>
    </section>
  </div>;
}
