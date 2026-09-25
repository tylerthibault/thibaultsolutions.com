import Link from "next/link";
export function CcNav({ userEmail }: { userEmail?: string }) {
  return <header className="cc-nav"><Link className="cc-brand" href="/creative-circle"><b>CC</b><span>CREATIVE CIRCLE</span></Link><div style={{display:"flex",alignItems:"center",gap:8}}><Link className="btn" href="/creative-circle/review">FEEDBACK</Link>{userEmail&&<span className="micro muted cc-user-email">{userEmail}</span>}<Link className="btn" href="/">THIBAULT SOLUTIONS ↗</Link></div></header>;
}
