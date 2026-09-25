import { redirect } from "next/navigation";
import { isCreativeCircleAdmin, requireSectionUser } from "@/src/lib/auth";

export default async function ReviewersPage() {
  const current = await requireSectionUser("feedback");
  redirect(isCreativeCircleAdmin(current.email) ? "/creative-circle/admin" : "/creative-circle/review");
}
