import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/src/lib/db";
import { isCreativeCircleAdmin } from "@/src/lib/auth";
import { user as users } from "@/src/lib/schema";

export async function CcNav({ userEmail }: { userEmail?: string }) {
  const admin = isCreativeCircleAdmin(userEmail);
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

  return <header className="cc-nav">
    <Link className="cc-brand" href="/creative-circle"><b>CC</b><span className="cc-brand-copy"><strong>CREATIVE CIRCLE</strong>{identityLabel&&<small>{identityLabel}</small>}</span></Link>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {labAccess&&<Link className="btn" href="/creative-circle/lab">VIDEO LAB</Link>}
      {feedbackAccess&&<Link className="btn" href="/creative-circle/review">FEEDBACK LAB</Link>}
      {admin&&<Link className="btn" href="/creative-circle/admin">ACCESS</Link>}
      <Link className="btn" href="/">THIBAULT SOLUTIONS ↗</Link>
    </div>
  </header>;
}
