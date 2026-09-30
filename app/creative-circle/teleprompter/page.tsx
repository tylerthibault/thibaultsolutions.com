import { requireUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";
import { TeleprompterStudio } from "@/src/components/TeleprompterStudio";

export default async function TeleprompterPage() {
  const user = await requireUser();

  return <>
    <CcNav userEmail={user.email} />
    <main className="teleprompter-page">
      <header className="teleprompter-page-head">
        <div>
          <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / TELEPROMPTER</span>
          <h1>Stay on script.<br/><em>Stay on camera.</em></h1>
        </div>
        <p>
          Put your script over a live camera preview, set a comfortable reading speed, and keep your eye line close to the lens.
        </p>
      </header>

      <TeleprompterStudio />
    </main>
  </>;
}
