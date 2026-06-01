import type { NextConfig } from "next";
import path from "path";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@stellar/stellar-sdk"],
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // smart-account-kit has an optional peer dependency that isn't on npm in our env.
      // We don't use external wallet adapters in SozuPay dashboard, but Next will still
      // try to resolve the module during bundling unless we alias it.
      "@creit-tech/stellar-wallets-kit": path.join(
        __dirname,
        "src/shims/creit-stellar-wallets-kit.js"
      ),
      "@creit-tech/stellar-wallets-kit/modules/utils": path.join(
        __dirname,
        "src/shims/creit-stellar-wallets-kit-utils.js"
      ),
    };
    return config;
  },
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
