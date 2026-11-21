/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
];

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Logo y portada se suben con server actions (máx. 2 MB validado en servidor); el límite por defecto es 1 MB.
  experimental: { serverActions: { bodySizeLimit: '3mb' } },
  async redirects() {
    // El registro público ya no existe: el acceso llega por invitación.
    return [{ source: '/registro', destination: '/ingresar', permanent: true }, { source: '/registro/:path*', destination: '/ingresar', permanent: true }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};
export default nextConfig;
