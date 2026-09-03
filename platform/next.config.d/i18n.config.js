/* eslint-disable import/no-anonymous-default-export, import/extensions */
// @ts-check
import config from '../i18n.config.js'

/** @type {import('next').NextConfig} */
export default {
  i18n: (() => {
    if (!config) {
      return undefined
    }

    // @note if we have just one locale we don't need to configure i18n because
    // it will double the number of routes and we don't need that

    if (config.locales.length <= 1) {
      return undefined
    }

    // eslint-disable-next-line no-console
    console.log(`[next.config.js] i18n locales: ${config.locales.join(', ')}`)

    return config
  })(),
}
