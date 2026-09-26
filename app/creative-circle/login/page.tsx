import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { LoginForm } from "@/src/components/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  const params = await searchParams;
  const nextPath = typeof params.next === "string" && params.next.startsWith("/creative-circle") ? params.next : "/creative-circle";
  if (session?.user) redirect(nextPath);

  return <main className="login-wrap">
    <section className="login-card">
      <span className="micro" style={{ color: "var(--lime)" }}>PRIVATE TOOL / ACCOUNT ACCESS</span>
      <h1>CREATIVE<br/>CIRCLE.</h1>
      <p className="muted">Video experiments and private feedback with the people you trust.</p>
      <LoginForm nextPath={nextPath}/>
      <p className="muted" style={{ marginTop: 18, fontSize: 11 }}>
        Need an account? <Link href="/creative-circle/signup" style={{ color: "var(--lime)" }}>Sign up with access PIN ↗</Link>
      </p>
    </section>
  </main>;
}
