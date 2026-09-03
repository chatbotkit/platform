/* eslint-disable import/no-anonymous-default-export */
// @ts-check

// @note captures are never rendered through next/image, so the capture host is
// deliberately not allowlisted here. The two places that use one hand it to a
// browser as a redirect target or fetch it server side, and neither goes
// through the image optimiser - adding the host back would only permit a use
// nothing makes.

/** @type {import('next').NextConfig} */
export default {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      // @todo add github?
    ],
  },
}
