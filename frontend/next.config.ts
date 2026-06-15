import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached through a tunnel (e.g. ngrok) for
  // cross-device testing. ngrok free URLs change on each restart — update or
  // add the new host here when that happens.
  allowedDevOrigins: ["tendentiously-impalpable-dede.ngrok-free.dev"],
};

export default nextConfig;
