import { redirect } from "next/navigation";
import { getSession, hasCreativeCircleAccess } from "@/src/lib/auth";
import { SignOutButton } from "@/src/components/SignOutButton";

export default async function AccessRequiredPage() {
  const session = await getSession();
  if (!session?.user) redirect("/creative-circle/login");
  if (await hasCreativeCircleAccess(session.user.id, session.user.email)) redirect("/creative-circle");

  return <main className="login-wrap">
    <section className="login-card">
      <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / ACCESS</span>
      <h1>ACCESS<br/>PENDING.</h1>
      <p className="muted" style={{ lineHeight: 1.6 }}>
        You are signed in as <strong style={{ color: "var(--ink)" }}>{session.user.email}</strong>, but this account is not currently enabled for any Creative Circle sections.
      </p>
      <p className="muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
        Ask the Creative Circle admin to enable Video Lab, Feedback Lab, or both, then refresh this page.
      </p>
      <div className="actions"><SignOutButton/></div>
    </section>
  </main>;
}
