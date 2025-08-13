/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const internalApiBase = process.env.API_BASE_INTERNAL || 'http://api:4000';
    return [
      {
        source: '/_api/:path*',
        destination: `${internalApiBase}/_api/:path*`, // <-- note _api here
      },
    ];
  },
};
export default nextConfig;
