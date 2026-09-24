import { requireUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";
import { ReviewersPanel } from "@/src/components/ReviewersPanel";

export default async function ReviewersPage() {
  const current = await requireUser();
  return <><CcNav userEmail={current.email}/><main className="cc-main" style={{ maxWidth: 980 }}>
    <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK / YOUR CIRCLE</span>
    <h1 className="feedback-page-title">TRUSTED<br/><span>EYES.</span></h1>
    <p className="muted" style={{ maxWidth: 650, lineHeight: 1.6 }}>Invite the people you actually want feedback from. The invite is one-time onboarding; after that they sign in normally.</p>
    <ReviewersPanel/>
  </main></>;
}
