/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: '', 
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
   // 3. 关键步骤：在这里把值传给前端
  env: {
    NEXT_PUBLIC_BASE_PATH: '', 
  },
}

export default nextConfig
