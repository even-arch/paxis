/** @type {import('next').NextConfig} */
const nextConfig = {
  // 告訴 Next.js 這些套件在 server 端不要 bundle，直接從 node_modules runtime 載入
  // mupdf：ESM-only WASM，需要在 runtime 找到 .wasm 檔
  experimental: {
    serverComponentsExternalPackages: ['mupdf'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // 這些套件有 native bindings 或 WASM，不能被 webpack 打包，
      // 讓 Node.js 在 runtime 直接從 node_modules 載入
      config.externals = [
        ...(config.externals || []),
        'ws', 'bufferutil', 'utf-8-validate',
        'mupdf',  // ESM-only WASM 套件，runtime 載入才能找到 .wasm 檔
      ]
    }
    return config
  },
}

module.exports = nextConfig
