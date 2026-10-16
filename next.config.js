const path = require("path");

const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del proyecto: evita el aviso de "multiple lockfiles" cuando
  // hay otro package-lock.json en una carpeta superior.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = withPWA(nextConfig);
