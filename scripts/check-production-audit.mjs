import { readFile } from "node:fs/promises";

const [auditPath, treePath] = process.argv.slice(2);
if (!auditPath || !treePath) throw new Error("Usage: node scripts/check-production-audit.mjs <audit.json> <prod-tree.json>");

const audit = JSON.parse(await readFile(auditPath, "utf8"));
const tree = JSON.parse(await readFile(treePath, "utf8"));
const productionPackages = new Set();

function walk(node) {
  for (const [name, child] of Object.entries(node?.dependencies ?? {})) {
    productionPackages.add(name);
    walk(child);
  }
}
walk(tree);

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
  console.log("Production-reachable audit findings:");
  console.log(JSON.stringify(findings, null, 2));
} else {
  console.log("No production-reachable npm audit findings.");
}

const blocking = findings.filter((item) => (rank[item.severity] ?? 0) >= rank.high);
if (blocking.length) {
  console.error(`Blocking production dependency audit: ${blocking.length} high/critical finding(s).`);
  process.exit(1);
}
