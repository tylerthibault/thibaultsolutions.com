import { requireCreativeCircleAdmin } from "@/src/lib/auth";
import { HomepageLandingEditor } from "@/src/components/HomepageLandingEditor";

export default async function CreativeCircleAdminPage() {
  await requireCreativeCircleAdmin();
  return <HomepageLandingEditor/>;
}
