/** @type {import('next').NextConfig} */
const nextConfig = {
  // 確保自訂路徑的 Prisma admin-client 被打包進 Vercel serverless function
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@prisma/admin-client/**'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // ws 有 native bindings，不能被 webpack 打包
      config.externals = [...(config.externals || []), 'ws', 'bufferutil', 'utf-8-validate']
    }
    return config
  },
}

module.exports = nextConfig
