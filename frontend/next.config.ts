import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["markmap-lib", "markmap-view", "markmap-common"],
};

export default nextConfig;
