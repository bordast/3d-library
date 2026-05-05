import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', `${process.env.CODESPACE_NAME}.app.github.dev`],
};

export default nextConfig;
