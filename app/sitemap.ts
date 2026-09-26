import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap { const base=process.env.APP_URL??"https://thibaultsolutions.com"; return [{url:base,lastModified:new Date(),changeFrequency:"weekly",priority:1},{url:`${base}/store`,lastModified:new Date(),changeFrequency:"monthly",priority:.6}]; }
