import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@stellar/stellar-sdk"],
  async redirects() {
    return [
      {
        source: "/dashboard/payments",
        destination: "/dashboard/disbursements",
        permanent: false,
      },
    ];
  },
  // Silence "multiple lockfiles" warning: use project root for file tracing (we use npm, not pnpm).
  ...(process.env.NODE_ENV === "production" && {
    outputFileTracingRoot: path.join(__dirname),
  }),
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
