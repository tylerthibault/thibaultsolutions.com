import { and, eq, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isCreativeCircleAdmin, requireSectionUser } from "@/src/lib/auth";
import { db } from "@/src/lib/db";
import { user as users } from "@/src/lib/schema";
import { CcNav } from "@/src/components/CcNav";
import { NewFeedbackVideoForm } from "@/src/components/NewFeedbackVideoForm";

export default async function NewFeedbackVideoPage() {
  const current = await requireSectionUser("feedback");
  if (!isCreativeCircleAdmin(current.email)) redirect("/creative-circle/review");

  const reviewers = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(
      eq(users.creativeCircleFeedbackAccess, true),
      ne(users.id, current.id),
    ));

  return <><CcNav userEmail={current.email}/><main className="cc-main" style={{ maxWidth: 980 }}>
    <span className="micro" style={{ color: "var(--lime)" }}>FEEDBACK LAB / NEW VIDEO</span>
    <h1 className="feedback-page-title">PUT IT<br/>IN THE <span>ROOM.</span></h1>
    <NewFeedbackVideoForm reviewers={reviewers}/>
  </main></>;
}
