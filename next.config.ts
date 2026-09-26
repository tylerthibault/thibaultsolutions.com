import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/legacy-home.html" },
        { source: "/store", destination: "/store/index.html" },
        { source: "/store/", destination: "/store/index.html" },
        { source: "/tech", destination: "/tech/index.html" },
        { source: "/bold", destination: "/bold/index.html" },
        { source: "/mashup", destination: "/mashup/index.html" }
      ],
      afterFiles: [],
      fallback: []
    };
  }
};
export default nextConfig;
