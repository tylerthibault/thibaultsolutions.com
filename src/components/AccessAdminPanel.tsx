"use client";

import { useMemo, useState } from "react";

type AccessUser = {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  isAdmin: boolean;
  createdAt: string;
};

export function AccessAdminPanel({ initialUsers }: { initialUsers: AccessUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q));
  }, [query, users]);

  const activeCount = users.filter((user) => user.enabled || user.isAdmin).length;

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

  return <section className="cc-panel access-admin-panel">
    <div className="access-admin-summary">
      <div>
        <span className="micro muted">ACCOUNT ACCESS</span>
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

    {message && <div className="muted access-admin-message">{message}</div>}

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
      {filtered.length === 0 && <p className="muted">No accounts match that search.</p>}
    </div>
  </section>;
}
