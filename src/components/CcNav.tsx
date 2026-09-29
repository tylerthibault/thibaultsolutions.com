import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { user as users } from "@/src/lib/schema";
import { CcNavClient } from "@/src/components/CcNavClient";

export async function CcNav({ userEmail }: { userEmail?: string }) {
  const admin = isCreativeCircleAdmin(userEmail);
  const publicGuest = !userEmail;
  let labAccess = admin;
  let feedbackAccess = admin;
  let identityLabel = userEmail;

  if (userEmail && !admin) {
    const [row] = await db.select({
      username: users.username,
      labAccess: users.creativeCircleLabAccess,
      feedbackAccess: users.creativeCircleFeedbackAccess,
    }).from(users).where(eq(users.email, userEmail)).limit(1);

    labAccess = row?.labAccess === true;
    feedbackAccess = row?.feedbackAccess === true;
    if (row?.username) identityLabel = `@${row.username}`;
  }

  return <CcNavClient
    admin={admin}
    publicGuest={publicGuest}
    labAccess={labAccess}
    feedbackAccess={feedbackAccess}
    identityLabel={identityLabel}
  />;
}
