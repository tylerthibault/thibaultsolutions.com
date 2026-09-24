import { cp, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
for (const dir of ["store", "tech", "bold", "mashup"]) {
  if (!existsSync(dir)) continue;
  const dest = `public/${dir}`;
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(dir, dest, { recursive: true });
}
