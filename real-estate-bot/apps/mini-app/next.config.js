/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@real-estate-bot/shared'],
  images: {
    domains: ['picsum.photos', 'via.placeholder.com', 'images.unsplash.com'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL', // Allow embedding in Telegram
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;