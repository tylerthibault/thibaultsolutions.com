import { requireSectionUser } from "@/src/lib/auth";
import { CcNav } from "@/src/components/CcNav";
import { VariationStudio } from "@/src/components/VariationStudio";

export default async function VariationStudioPage() {
  const user = await requireSectionUser("lab");

  return <>
    <CcNav userEmail={user.email} />
    <main className="variation-page">
      <header className="variation-page-head">
        <div>
          <span className="micro" style={{ color: "var(--lime)" }}>CREATIVE CIRCLE / VARIATION STUDIO</span>
          <h1>Record the pieces.<br/><em>Multiply the output.</em></h1>
        </div>
        <p>
          Record hooks, bodies, and CTAs once with the teleprompter, then automatically assemble every combination into finished vertical videos.
        </p>
      </header>

      <VariationStudio />
    </main>
  </>;
}
