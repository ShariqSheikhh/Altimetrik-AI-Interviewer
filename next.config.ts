import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase the body size limit for the video upload proxy route.
  // Without this, Next.js will reject multipart bodies larger than ~4 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
