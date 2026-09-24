"use client";
import { authClient } from "@/src/lib/auth-client";
export function SignOutButton(){return <button className="btn" onClick={async()=>{await authClient.signOut();location.href="/creative-circle/login"}}>LOG OUT</button>}
