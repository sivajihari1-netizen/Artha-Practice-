/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdfkit reads its font metrics (.afm) files from disk relative to its own
  // package location at runtime. Webpack's default bundling relocates/inlines
  // the route code and breaks that lookup — excluding it from the bundle so
  // it's require()'d normally from node_modules at runtime fixes it.
  experimental: {
    serverComponentsExternalPackages: ["pdfkit"],
  },
};

module.exports = nextConfig;
