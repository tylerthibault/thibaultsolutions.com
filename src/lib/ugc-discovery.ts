import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { ugcBrandLeads, ugcDiscoveryTargets } from "./schema";

export const UGC_DISCOVERY_SOURCE_TYPES = ["AUTO", "GREENHOUSE", "LEVER", "GENERIC"] as const;
export type UgcDiscoverySourceType = typeof UGC_DISCOVERY_SOURCE_TYPES[number];

export type UgcDiscoveryTarget = typeof ugcDiscoveryTargets.$inferSelect;

export type UgcDiscoveryFinding = {
  title: string;
  url: string;
  applyUrl?: string | null;
  location?: string | null;
  provider: "Greenhouse" | "Lever" | "Careers page";
  score: number;
  publishedAt?: Date | null;
};

export type UgcRefreshResult = {
  targetId: string;
  targetName: string;
  status: "FOUND" | "NO_MATCHES" | "ERROR";
  findingCount: number;
  bestFinding?: UgcDiscoveryFinding;
  error?: string;
};

const DEFAULT_KEYWORDS = [
  "ugc",
  "user generated content",
  "content creator",
  "social content creator",
  "social media creator",
  "tiktok creator",
  "short-form creator",
  "short form creator",
  "creator partnerships",
  "creator marketing",
  "influencer marketing",
  "brand ambassador",
  "social media content",
];

const MAX_RESPONSE_CHARS = 3_000_000;
const FETCH_TIMEOUT_MS = 12_000;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function keywordList(extra: string) {
  const custom = extra
    .split(/[\n,]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_KEYWORDS, ...custom]));
}

function relevanceScore(title: string, body: string, keywords: string[]) {
  const titleLower = title.toLowerCase();
  const bodyLower = body.toLowerCase();
  let score = 0;
  for (const keyword of keywords) {
    if (titleLower.includes(keyword)) score += 6;
    if (bodyLower.includes(keyword)) score += 1;
  }
  if (/\b(ugc|creator|content|social|tiktok|reels|influencer)\b/i.test(title)) score += 3;
  return score;
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0.0.0.0") return true;
  if (address.startsWith("fc") || address.startsWith("fd") || address.startsWith("fe80:")) return true;
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 0;
}

async function assertPublicHttpsUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:") throw new Error("Discovery sources must use HTTPS");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) throw new Error("Local discovery URLs are not allowed");
  if (isIP(hostname) && isPrivateAddress(hostname)) throw new Error("Private discovery URLs are not allowed");

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Discovery URL resolves to a private address");
  }
  return url;
}

async function safeFetchText(raw: string, redirects = 0): Promise<{ url: URL; text: string; contentType: string }> {
  if (redirects > 4) throw new Error("Too many redirects");
  const url = await assertPublicHttpsUrl(raw);
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "accept": "application/json,text/html;q=0.9,*/*;q=0.8",
      "user-agent": "ThibaultSolutions-UGC-Radar/1.0",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect from ${url.hostname} did not include a location`);
    return safeFetchText(new URL(location, url).toString(), redirects + 1);
  }
  if (!response.ok) throw new Error(`${url.hostname} returned HTTP ${response.status}`);

  const declaredLength = Number(response.headers.get("content-length") || "0");
  if (declaredLength > MAX_RESPONSE_CHARS) throw new Error("Discovery response was too large");

  const text = await response.text();
  if (text.length > MAX_RESPONSE_CHARS) throw new Error("Discovery response was too large");
  return { url, text, contentType: response.headers.get("content-type") || "" };
}

export function detectUgcDiscoverySourceType(raw: string): UgcDiscoverySourceType {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host.includes("greenhouse.io")) return "GREENHOUSE";
    if (host === "jobs.lever.co" || host === "api.lever.co") return "LEVER";
  } catch {
    return "GENERIC";
  }
  return "GENERIC";
}

function greenhouseToken(raw: string) {
  const url = new URL(raw);
  if (url.hostname === "boards-api.greenhouse.io") {
    const match = url.pathname.match(/\/v1\/boards\/([^/]+)/);
    if (match) return match[1];
  }
  return url.pathname.split("/").filter(Boolean)[0] || "";
}

function leverSite(raw: string) {
  const url = new URL(raw);
  if (url.hostname === "api.lever.co") {
    const match = url.pathname.match(/\/v0\/postings\/([^/]+)/);
    if (match) return match[1];
  }
  return url.pathname.split("/").filter(Boolean)[0] || "";
}

async function fetchGreenhouse(raw: string, keywords: string[]): Promise<UgcDiscoveryFinding[]> {
  const token = greenhouseToken(raw);
  if (!token) throw new Error("Could not determine Greenhouse board token");
  const endpoint = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
  const { text } = await safeFetchText(endpoint);
  const payload = JSON.parse(text) as {
    jobs?: Array<{
      title?: string;
      absolute_url?: string;
      content?: string;
      location?: { name?: string };
      updated_at?: string;
    }>;
  };

  return (payload.jobs ?? [])
    .map((job) => {
      const title = job.title?.trim() || "Untitled opportunity";
      const body = stripHtml(job.content || "");
      const score = relevanceScore(title, body, keywords);
      return {
        title,
        url: job.absolute_url || raw,
        applyUrl: job.absolute_url || raw,
        location: job.location?.name || null,
        provider: "Greenhouse" as const,
        score,
        publishedAt: job.updated_at ? new Date(job.updated_at) : null,
      };
    })
    .filter((finding) => finding.score > 0)
    .sort((a, b) => b.score - a.score);
}

async function fetchLever(raw: string, keywords: string[]): Promise<UgcDiscoveryFinding[]> {
  const site = leverSite(raw);
  if (!site) throw new Error("Could not determine Lever site name");
  const endpoint = `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`;
  const { text } = await safeFetchText(endpoint);
  const payload = JSON.parse(text) as Array<{
    text?: string;
    hostedUrl?: string;
    applyUrl?: string;
    descriptionPlain?: string;
    additionalPlain?: string;
    categories?: { location?: string };
    createdAt?: number;
  }>;

  return (Array.isArray(payload) ? payload : [])
    .map((job) => {
      const title = job.text?.trim() || "Untitled opportunity";
      const body = [job.descriptionPlain, job.additionalPlain].filter(Boolean).join(" ");
      const score = relevanceScore(title, body, keywords);
      return {
        title,
        url: job.hostedUrl || job.applyUrl || raw,
        applyUrl: job.applyUrl || job.hostedUrl || raw,
        location: job.categories?.location || null,
        provider: "Lever" as const,
        score,
        publishedAt: job.createdAt ? new Date(job.createdAt) : null,
      };
    })
    .filter((finding) => finding.score > 0)
    .sort((a, b) => b.score - a.score);
}

function extractAnchors(html: string, baseUrl: URL) {
  const anchors: Array<{ url: string; text: string; context: string }> = [];
  const regex = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) && anchors.length < 1200) {
    try {
      const url = new URL(decodeHtml(match[1]), baseUrl);
      if (url.protocol !== "https:") continue;
      const start = Math.max(0, match.index - 350);
      const end = Math.min(html.length, regex.lastIndex + 350);
      anchors.push({
        url: url.toString(),
        text: stripHtml(match[2]),
        context: stripHtml(html.slice(start, end)),
      });
    } catch {
      // Ignore malformed links.
    }
  }
  return anchors;
}

async function fetchGeneric(raw: string, keywords: string[]): Promise<UgcDiscoveryFinding[]> {
  const { url, text, contentType } = await safeFetchText(raw);
  if (!contentType.includes("html") && !/^\s*</.test(text)) {
    throw new Error("Generic discovery source did not return HTML");
  }

  const anchors = extractAnchors(text, url);
  const providerLink = anchors.find((anchor) => detectUgcDiscoverySourceType(anchor.url) !== "GENERIC");
  if (providerLink) {
    const provider = detectUgcDiscoverySourceType(providerLink.url);
    if (provider === "GREENHOUSE") return fetchGreenhouse(providerLink.url, keywords);
    if (provider === "LEVER") return fetchLever(providerLink.url, keywords);
  }

  const seen = new Set<string>();
  return anchors
    .map((anchor) => ({
      title: anchor.text || "Career opportunity",
      url: anchor.url,
      applyUrl: anchor.url,
      location: null,
      provider: "Careers page" as const,
      score: relevanceScore(anchor.text, anchor.context, keywords),
      publishedAt: null,
    }))
    .filter((finding) => {
      if (finding.score <= 0 || seen.has(finding.url)) return false;
      seen.add(finding.url);
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
}

async function findingsForTarget(target: UgcDiscoveryTarget) {
  const keywords = keywordList(target.keywords);
  const sourceType = target.sourceType === "AUTO"
    ? detectUgcDiscoverySourceType(target.sourceUrl)
    : target.sourceType as UgcDiscoverySourceType;

  if (sourceType === "GREENHOUSE") return fetchGreenhouse(target.sourceUrl, keywords);
  if (sourceType === "LEVER") return fetchLever(target.sourceUrl, keywords);
  return fetchGeneric(target.sourceUrl, keywords);
}

export async function listUgcDiscoveryTargets() {
  return db.select().from(ugcDiscoveryTargets).orderBy(desc(ugcDiscoveryTargets.updatedAt));
}

async function upsertLeadFromFinding(target: UgcDiscoveryTarget, finding: UgcDiscoveryFinding) {
  const [existing] = await db.select().from(ugcBrandLeads)
    .where(or(
      eq(ugcBrandLeads.discoveryTargetId, target.id),
      sql`lower(${ugcBrandLeads.brand}) = lower(${target.name})`,
    ))
    .limit(1);

  const now = new Date();
  const signal = `Open opportunity: ${finding.title}${finding.location ? ` — ${finding.location}` : ""}`;
  const source = `${finding.provider} / automated refresh`;

  if (existing) {
    const [updated] = await db.update(ugcBrandLeads).set({
      discoveryTargetId: target.id,
      category: existing.category === "General" ? target.category : existing.category,
      signal,
      source,
      sourceUrl: finding.url,
      contactUrl: existing.contactUrl || finding.applyUrl || finding.url,
      lastVerifiedAt: now,
      discoveredAt: existing.discoveredAt || now,
      researchedAt: now,
      updatedAt: now,
    }).where(eq(ugcBrandLeads.id, existing.id)).returning();
    return updated;
  }

  const [created] = await db.insert(ugcBrandLeads).values({
    brand: target.name,
    category: target.category,
    signal,
    source,
    sourceUrl: finding.url,
    contactUrl: finding.applyUrl || finding.url,
    compensation: "Not listed",
    creatorFit: "Potential UGC / creator opportunity discovered automatically. Review the source before outreach.",
    status: "RESEARCH",
    researchNotes: `Auto-discovered from ${target.sourceUrl}. Verify deliverables, usage rights, compensation, and contact details before pitching.`,
    discoveryTargetId: target.id,
    discoveredAt: now,
    lastVerifiedAt: now,
    researchedAt: now,
    updatedAt: now,
  }).returning();
  return created;
}

export async function refreshUgcDiscoveryTargets(targetIds?: string[]) {
  const where = targetIds?.length
    ? and(eq(ugcDiscoveryTargets.enabled, true), inArray(ugcDiscoveryTargets.id, targetIds))
    : eq(ugcDiscoveryTargets.enabled, true);
  const targets = await db.select().from(ugcDiscoveryTargets).where(where).orderBy(desc(ugcDiscoveryTargets.updatedAt));

  const results: UgcRefreshResult[] = [];
  let leadsChanged = 0;

  for (const target of targets) {
    try {
      const findings = await findingsForTarget(target);
      const bestFinding = findings[0];
      const now = new Date();

      if (bestFinding) {
        await upsertLeadFromFinding(target, bestFinding);
        leadsChanged += 1;
      }

      await db.update(ugcDiscoveryTargets).set({
        sourceType: target.sourceType === "AUTO" ? detectUgcDiscoverySourceType(target.sourceUrl) : target.sourceType,
        lastCheckedAt: now,
        lastStatus: bestFinding ? `FOUND ${findings.length}` : "NO MATCHES",
        lastError: null,
        updatedAt: now,
      }).where(eq(ugcDiscoveryTargets.id, target.id));

      results.push({
        targetId: target.id,
        targetName: target.name,
        status: bestFinding ? "FOUND" : "NO_MATCHES",
        findingCount: findings.length,
        bestFinding,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown discovery error";
      const now = new Date();
      await db.update(ugcDiscoveryTargets).set({
        lastCheckedAt: now,
        lastStatus: "ERROR",
        lastError: message,
        updatedAt: now,
      }).where(eq(ugcDiscoveryTargets.id, target.id));
      results.push({
        targetId: target.id,
        targetName: target.name,
        status: "ERROR",
        findingCount: 0,
        error: message,
      });
    }
  }

  return {
    checked: targets.length,
    leadsChanged,
    found: results.filter((result) => result.status === "FOUND").length,
    noMatches: results.filter((result) => result.status === "NO_MATCHES").length,
    errors: results.filter((result) => result.status === "ERROR").length,
    results,
  };
}
