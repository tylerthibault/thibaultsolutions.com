"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/src/lib/auth-client";
export function SignOutButton(){const router=useRouter();return <button className="btn" onClick={async()=>{await authClient.signOut();router.push("/creative-circle/login");router.refresh()}}>LOG OUT</button>}
