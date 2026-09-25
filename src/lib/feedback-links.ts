export type FeedbackProvider = "youtube" | "tiktok" | "instagram";

export function parseFeedbackLink(raw: string): { provider: FeedbackProvider; canonicalUrl: string; embedUrl: string } | null {
  let url: URL;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
    let id = "";
    if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    else if (url.pathname.startsWith("/shorts/")) id = url.pathname.split("/")[2] ?? "";
    else if (url.pathname === "/watch") id = url.searchParams.get("v") ?? "";
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return { provider: "youtube", canonicalUrl: `https://www.youtube.com/shorts/${id}`, embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  if (host === "tiktok.com" || host === "m.tiktok.com") {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (!match) return null;
    return { provider: "tiktok", canonicalUrl: `https://www.tiktok.com${url.pathname}`, embedUrl: `https://www.tiktok.com/player/v1/${match[1]}?loop=1` };
  }

  if (host === "instagram.com") {
    const match = url.pathname.match(/^\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    const kind = match[1] === "reels" ? "reel" : match[1];
    const canonicalUrl = `https://www.instagram.com/${kind}/${match[2]}/`;
    return { provider: "instagram", canonicalUrl, embedUrl: `${canonicalUrl}embed/` };
  }

  return null;
}
