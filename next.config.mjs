/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
];

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    // El registro público ya no existe: las cuentas las crea el equipo de Stampa.
    return [{ source: '/registro', destination: '/ingresar', permanent: true }, { source: '/registro/:path*', destination: '/ingresar', permanent: true }];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  }
};
export default nextConfig;
