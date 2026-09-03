import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'abstractapi/ip/geolocate': createFetchTemplate({
    provider: 'abstractapi',
    icon: '@logo/abstractapi.com',
    name: 'Geolocate IP Address',
    description:
      'Get geographical location data from an IP address including country, city, timezone, and coordinates',
    tags: ['abstractapi', 'ip', 'geolocation', 'location'],
    secret: '@abstractapi',
    instruction: {
      method: 'GET',
      url: 'https://ipgeolocation.abstractapi.com',
      path: ['/v1'],
      query: {
        api_key: secret(),
        ip_address: field({
          name: 'ipAddress',
          description: 'the IP address to geolocate',
        }),
      },
    },
  }),
}

export default abilities
