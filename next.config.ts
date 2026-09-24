import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async rewrites() {
    return [
      { source: "/store", destination: "/store/index.html" },
      { source: "/store/", destination: "/store/index.html" },
      { source: "/tech", destination: "/tech/index.html" },
      { source: "/bold", destination: "/bold/index.html" },
      { source: "/mashup", destination: "/mashup/index.html" }
    ];
  }
};
export default nextConfig;
