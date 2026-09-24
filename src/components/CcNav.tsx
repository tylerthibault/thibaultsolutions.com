import Link from "next/link";
export function CcNav({ userEmail }: { userEmail?: string }) {
  return <header className="cc-nav"><Link className="cc-brand" href="/creative-circle"><b>CC</b><span>CREATIVE CIRCLE</span></Link><div style={{display:"flex",alignItems:"center",gap:12}}>{userEmail&&<span className="micro muted">{userEmail}</span>}<Link className="btn" href="/">THIBAULT SOLUTIONS ↗</Link></div></header>;
}
