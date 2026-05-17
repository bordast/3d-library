import type { NextConfig } from "next";
import os from 'os'

function getLocalNetworkIPs(): string[] {
    const result: string[] = []
    for (const ifaces of Object.values(os.networkInterfaces())) {
        for (const iface of ifaces ?? []) {
            if (iface.family === 'IPv4' && !iface.internal) result.push(iface.address)
        }
    }
    return result
}

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['127.0.0.1', ...getLocalNetworkIPs(), `${process.env.CODESPACE_NAME}.app.github.dev`],
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
