import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots { const base=process.env.APP_URL??"https://thibaultsolutions.com"; return { rules:[{userAgent:"*",allow:"/",disallow:["/creative-circle","/api/"]}], sitemap:`${base}/sitemap.xml` }; }
