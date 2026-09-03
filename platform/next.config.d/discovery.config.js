// @ts-check

/** @type {import('next').NextConfig} */
export default {
  async headers() {
    return [
      {
        source: '/',
        headers: [
          {
            key: 'Link',
            value: [
              '</.well-known/api-catalog>; rel="api-catalog"',
              '</api/v1/spec>; rel="service-desc"; type="application/json"',
              '<https://docs.cbk.ai/spec/v1>; rel="service-doc"; type="text/html"',
            ].join(', '),
          },
        ],
      },
    ]
  },
}
