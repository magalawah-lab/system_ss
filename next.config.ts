// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allowed origins for the app
  allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000'],
  
  // CORS headers
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },
  
  // Other configs
  reactStrictMode: true,
};

module.exports = nextConfig;