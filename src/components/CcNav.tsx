import Link from "next/link";

export function CcNav({ userEmail }: { userEmail?: string }) {
  const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const isAdmin = Boolean(ownerEmail && userEmail?.trim().toLowerCase() === ownerEmail);

  return <header className="cc-nav">
    <Link className="cc-brand" href="/creative-circle"><b>CC</b><span>CREATIVE CIRCLE</span></Link>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Link className="btn" href="/creative-circle/review">FEEDBACK</Link>
      {isAdmin && <Link className="btn" href="/creative-circle/admin">ACCESS</Link>}
      {userEmail && <span className="micro muted cc-user-email">{userEmail}</span>}
      <Link className="btn" href="/">THIBAULT SOLUTIONS ↗</Link>
    </div>
  </header>;
}
