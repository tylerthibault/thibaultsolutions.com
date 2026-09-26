import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { SignupForm } from "@/src/components/SignupForm";

export default async function SignupPage() {
  const session = await getSession();
  if (session?.user) redirect("/creative-circle");

  return <main className="login-wrap">
    <section className="login-card">
      <span className="micro" style={{ color: "var(--lime)" }}>PIN-GATED ACCESS / PRIVATE TOOL</span>
      <h1>JOIN THE<br/>CIRCLE.</h1>
      <p className="muted">Create an account using the private access PIN.</p>
      <SignupForm/>
      <p className="muted" style={{ marginTop: 18, fontSize: 11 }}>
        Already have an account? <Link href="/creative-circle/login" style={{ color: "var(--lime)" }}>Sign in ↗</Link>
      </p>
    </section>
  </main>;
}
