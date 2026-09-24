import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { LoginForm } from "@/src/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/creative-circle");

  return <main className="login-wrap">
    <section className="login-card">
      <span className="micro" style={{ color: "var(--lime)" }}>PRIVATE TOOL / ACCOUNT ACCESS</span>
      <h1>CREATIVE<br/>CIRCLE.</h1>
      <p className="muted">Upload video. Stack visual experiments. Render the finished MP4.</p>
      <LoginForm/>
      <p className="muted" style={{ marginTop: 18, fontSize: 11 }}>
        Need an account? <Link href="/creative-circle/signup" style={{ color: "var(--lime)" }}>Sign up with access PIN ↗</Link>
      </p>
    </section>
  </main>;
}
