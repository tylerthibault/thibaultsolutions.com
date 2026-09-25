import { eq } from "drizzle-orm";
import { requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { circleMemberships, user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { NewFeedbackVideoForm } from "@/src/components/NewFeedbackVideoForm";

export default async function NewFeedbackVideoPage() {
  const current = await requireSectionUser("feedback");
  const reviewers = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(circleMemberships)
    .innerJoin(users, eq(circleMemberships.memberUserId, users.id))
    .where(eq(circleMemberships.ownerId, current.id));
  return <><CcNav userEmail={current.email}/><main className="cc-main" style={{ maxWidth: 980 }}>
    <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK / NEW VIDEO</span>
    <h1 className="feedback-page-title">PUT IT<br/>IN THE <span>ROOM.</span></h1>
    <NewFeedbackVideoForm reviewers={reviewers}/>
  </main></>;
}
