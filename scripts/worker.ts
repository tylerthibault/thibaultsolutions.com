import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { PgBoss } from "pg-boss";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { and, eq } from "drizzle-orm";
import { exportsTable, mediaAssets, projects, renderJobs } from "../src/lib/schema.js";
import { filtersForStack } from "../src/lib/effects/export.js";

const databaseUrl=process.env.DATABASE_URL; if(!databaseUrl) throw new Error("DATABASE_URL is required");
const root=path.resolve(process.env.MEDIA_STORAGE_PATH??"/data"); const ffmpeg=process.env.FFMPEG_PATH??"ffmpeg";
const pool=new Pool({connectionString:databaseUrl}); const db=drizzle(pool); const boss=new PgBoss(databaseUrl); boss.on("error",e=>console.error("pg-boss",e)); await boss.start();
const QUEUE="creative-circle-render"; await boss.createQueue(QUEUE).catch(()=>undefined);
const even=(n:number)=>Math.max(2,Math.round(n/2)*2);
function dimensions(w:number,h:number,res:string){if(res==="source") return [even(w),even(h)] as const; const target=res==="1080p"?1080:720; if(h>=w){const nw=Math.min(w,target); return [even(nw),even(h*(nw/w))] as const;} const nh=Math.min(h,target); return [even(w*(nh/h)),even(nh)] as const;}
function runFfmpeg(args:string[],durationMs:number,onProgress:(p:number)=>void){return new Promise<void>((resolve,reject)=>{const proc=spawn(ffmpeg,args,{stdio:["ignore","pipe","pipe"]});let progressBuf="",err=""; proc.stdout.on("data",d=>{progressBuf+=d.toString();const lines=progressBuf.split(/\r?\n/);progressBuf=lines.pop()??"";for(const line of lines){const [k,v]=line.split("=");if(k==="out_time_us"){const ms=Number(v)/1000;if(Number.isFinite(ms))onProgress(Math.min(98,Math.floor(ms/durationMs*100)));}}});proc.stderr.on("data",d=>{err+=d.toString();if(err.length>12000)err=err.slice(-12000)});proc.on("error",reject);proc.on("close",code=>code===0?resolve():reject(new Error(err.slice(-4000)||`ffmpeg exited ${code}`)));});}
await boss.work(QUEUE,async ([job])=>{
  const renderJobId=String((job.data as {renderJobId:string}).renderJobId); const started=new Date();
  const [render]=await db.select().from(renderJobs).where(eq(renderJobs.id,renderJobId)).limit(1); if(!render) throw new Error("Render job missing");
  try{
    await db.update(renderJobs).set({status:"preparing",progress:1,updatedAt:new Date()}).where(eq(renderJobs.id,renderJobId));
    const rows=await db.select({project:projects,asset:mediaAssets}).from(projects).innerJoin(mediaAssets,eq(projects.assetId,mediaAssets.id)).where(and(eq(projects.id,render.projectId),eq(projects.ownerId,render.ownerId))).limit(1); const row=rows[0]; if(!row) throw new Error("Project or source asset missing");
    const input=path.join(root,"uploads",path.basename(row.asset.storageKey)); const outputKey=`${render.id}.mp4`; const output=path.join(root,"renders",outputKey); const [ow,oh]=dimensions(row.asset.width,row.asset.height,render.resolution);
    const fx=filtersForStack(row.project.effectStack); const vf=[fx,`scale=${ow}:${oh}:flags=lanczos`].filter(Boolean).join(","); const crf=render.quality==="high"?18:render.quality==="small"?28:22;
    await db.update(renderJobs).set({status:"rendering",progress:2,updatedAt:new Date()}).where(eq(renderJobs.id,renderJobId));
    const args=["-hide_banner","-y","-i",input,"-map","0:v:0",...(render.keepAudio?["-map","0:a?"]:[]),"-vf",vf,"-c:v","libx264","-preset","medium","-crf",String(crf),"-pix_fmt","yuv420p",...(render.keepAudio?["-c:a","aac","-b:a","192k"]:["-an"]),"-movflags","+faststart","-progress","pipe:1","-nostats",output];
    let last=0; await runFfmpeg(args,row.asset.durationMs,(p)=>{if(p-last>=3){last=p;void db.update(renderJobs).set({status:p>90?"encoding":"rendering",progress:p,updatedAt:new Date()}).where(eq(renderJobs.id,renderJobId));}});
    const info=await stat(output); await db.insert(exportsTable).values({projectId:row.project.id,renderJobId:render.id,ownerId:render.ownerId,storageKey:outputKey,resolution:`${ow}x${oh}`,durationMs:row.asset.durationMs,sizeBytes:info.size}); await db.update(renderJobs).set({status:"complete",progress:100,updatedAt:new Date(),completedAt:new Date()}).where(eq(renderJobs.id,renderJobId));
    console.log(JSON.stringify({event:"render.complete",renderId:render.id,projectId:row.project.id,effects:row.project.effectStack.map(x=>x.effectId),source:{width:row.asset.width,height:row.asset.height,durationMs:row.asset.durationMs},startedAt:started.toISOString(),endedAt:new Date().toISOString()}));
  }catch(error){const message=error instanceof Error?error.message:String(error); await db.update(renderJobs).set({status:"failed",error:message.slice(0,2000),updatedAt:new Date(),completedAt:new Date()}).where(eq(renderJobs.id,renderJobId)); console.error(JSON.stringify({event:"render.failed",renderId:renderJobId,error:message,startedAt:started.toISOString(),endedAt:new Date().toISOString()})); throw error;}
});
console.log("Creative Circle worker ready");
process.on("SIGTERM",async()=>{await boss.stop();await pool.end();process.exit(0)});
