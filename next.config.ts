import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The floating "Rendering"/route badge Next.js shows during development. It never appears in
  // a deployed build, but it sits on top of the widget while working locally and makes the page
  // hard to judge. Compile and runtime errors are still surfaced with this off.
  devIndicators: false,
};

export default nextConfig;
