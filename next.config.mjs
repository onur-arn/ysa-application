/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cwkjrikbaiiwmdifihvp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",            value: "nosniff" },
          { key: "X-Frame-Options",                   value: "DENY" },
          { key: "X-XSS-Protection",                  value: "1; mode=block" },
          { key: "Referrer-Policy",                   value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",                value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security",         value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ]
  },
}

export default nextConfig
