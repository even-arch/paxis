/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // ws 有 native bindings，不能被 webpack 打包
      config.externals = [...(config.externals || []), 'ws', 'bufferutil', 'utf-8-validate']
    }
    return config
  },
}

module.exports = nextConfig
