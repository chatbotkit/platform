/* eslint-disable import/no-anonymous-default-export */
// @ts-check

/** @type {import('next').NextConfig} */
export default {
  modularizeImports: {
    // lodash
    ...{
      lodash: {
        transform: 'lodash/{{member}}',
      },

      'lodash-es': {
        transform: 'lodash-es/{{member}}',
      },
    },

    // react-icons
    ...{
      // @todo deal with it
    },

    // heroicons
    ...(process.env.NODE_ENV === 'test'
      ? {}
      : {
          '@heroicons/react/20/solid': {
            transform: '@heroicons/react/20/solid/esm/{{member}}',
          },
          '@heroicons/react/20/outline': {
            transform: '@heroicons/react/20/outline/esm/{{member}}',
          },
          '@heroicons/react/24/solid': {
            transform: '@heroicons/react/24/solid/esm/{{member}}',
          },
          '@heroicons/react/24/outline': {
            transform: '@heroicons/react/24/outline/esm/{{member}}',
          },
        }),
  },
}
