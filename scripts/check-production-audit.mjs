import { readFile } from "node:fs/promises";

const [auditPath, lockPath] = process.argv.slice(2);
if (!auditPath || !lockPath) throw new Error("Usage: node scripts/check-production-audit.mjs <audit.json> <package-lock.json>");

const audit = JSON.parse(await readFile(auditPath, "utf8"));
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const productionPackages = new Set();

for (const [location, metadata] of Object.entries(lock.packages ?? {})) {
  if (!location || !location.includes("node_modules/")) continue;
  if (metadata?.dev || metadata?.devOptional) continue;
  const name = location.split("node_modules/").pop();
  if (name) productionPackages.add(name);
}

const rank = { low: 1, moderate: 2, high: 3, critical: 4 };
const findings = Object.entries(audit.vulnerabilities ?? {})
  .filter(([name]) => productionPackages.has(name))
  .map(([name, vulnerability]) => ({
    name,
    severity: vulnerability.severity,
    direct: Boolean(vulnerability.isDirect),
    range: vulnerability.range,
    fixAvailable: vulnerability.fixAvailable,
    via: (vulnerability.via ?? []).map((item) => typeof item === "string" ? item : {
      source: item.source,
      title: item.title,
      severity: item.severity,
      url: item.url,
      range: item.range
    })
  }))
  .sort((a, b) => (rank[b.severity] ?? 0) - (rank[a.severity] ?? 0));

if (findings.length) {
  console.log("Production dependency audit findings:");
  console.log(JSON.stringify(findings, null, 2));
} else {
  console.log("No production dependency audit findings.");
}

const blocking = findings.filter((item) => (rank[item.severity] ?? 0) >= rank.high);
if (blocking.length) {
  console.error(`Blocking production dependency audit: ${blocking.length} high/critical finding(s).`);
  process.exit(1);
}
