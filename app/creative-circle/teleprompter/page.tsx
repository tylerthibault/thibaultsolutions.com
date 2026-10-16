import { requireUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";
import { QuickRecordingStudio } from "@/src/components/QuickRecordingStudio";

export default async function TeleprompterPage() {
  const user = await requireUser();

  return <>
    <CcNav userEmail={user.email} />
    <main className="teleprompter-page">
      <header className="teleprompter-page-head">
        <div>
          <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / TELEPROMPTER V6.1</span>
          <h1>Film the parts.<br/><em>Save one video.</em></h1>
        </div>
        <p>Record your hook, two body sections, and CTA using the teleprompter. Then join the clips and download a finished video without an editor.</p>
      </header>
      <QuickRecordingStudio />
    </main>
  </>;
}
