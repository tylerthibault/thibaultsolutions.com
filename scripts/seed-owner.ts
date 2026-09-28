import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/lib/schema.js";
const email=process.env.OWNER_EMAIL,password=process.env.OWNER_PASSWORD,url=process.env.DATABASE_URL;
if(!email||!password||!url) throw new Error("OWNER_EMAIL, OWNER_PASSWORD, and DATABASE_URL are required");
const pool=new Pool({connectionString:url});const db=drizzle(pool,{schema});
const auth=betterAuth({secret:process.env.BETTER_AUTH_SECRET,baseURL:process.env.APP_URL,database:drizzleAdapter(db,{provider:"pg",schema}),emailAndPassword:{enabled:true,disableSignUp:false,minPasswordLength:12}});
try{await auth.api.signUpEmail({body:{email,password,name:"Tyler Thibault"}});console.log(`Owner account created: ${email}`)}catch(error){const m=error instanceof Error?error.message:String(error);if(/already|exist|duplicate/i.test(m))console.log(`Owner account already exists: ${email}`);else throw error}finally{await pool.end()}
