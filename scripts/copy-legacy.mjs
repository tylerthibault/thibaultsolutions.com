import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

await mkdir("public", { recursive: true });

if (existsSync("index.html")) {
  await cp("index.html", "public/legacy-home.html");
}
if (existsSync("favicon.svg")) {
  await cp("favicon.svg", "public/favicon.svg");
}

for (const dir of ["store", "tech", "bold", "mashup"]) {
  if (!existsSync(dir)) continue;
  const dest = `public/${dir}`;
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(dir, dest, { recursive: true });
}
