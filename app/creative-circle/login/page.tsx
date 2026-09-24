import { redirect } from "next/navigation";
import { getSession } from "@/src/lib/auth";
import { LoginForm } from "@/src/components/LoginForm";
export default async function LoginPage(){const session=await getSession();if(session?.user)redirect("/creative-circle");return <main className="login-wrap"><section className="login-card"><span className="micro" style={{color:"var(--lime)"}}>OWNER ACCESS / PRIVATE TOOL</span><h1>CREATIVE<br/>CIRCLE.</h1><p className="muted">Upload video. Stack visual experiments. Render the finished MP4.</p><LoginForm/></section></main>}
