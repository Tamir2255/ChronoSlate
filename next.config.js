/** Next.js configuration */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true
  },
  // Expose public runtime keys only if needed — prefer NEXT_PUBLIC_*
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  },
  images: {
    domains: ["images.unsplash.com"]
  }
};

module.exports = nextConfig;
