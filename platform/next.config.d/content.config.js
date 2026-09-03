export default {
  async redirects() {
    return [
      {
        source: '/manuals/:path*',
        destination: 'https://docs.cbk.ai/:path*',
        permanent: true,
      },
    ]
  },
}
