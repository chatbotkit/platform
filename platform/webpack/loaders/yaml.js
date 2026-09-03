import yaml from 'js-yaml'
import loaderUtils from 'loader-utils'
import uneval from 'un-eval'

/**
 * Webpack loader function
 *
 * @param {string} source - The yaml file content
 * @returns {string} - JavaScript module exporting the yaml data
 */
export default function yamlLoader(source) {
  this.cacheable && this.cacheable()

  try {
    const options = loaderUtils.getOptions(this) || {}

    let data = yaml.load(source, options)

    // load specific sections of the document
    {
      const params = loaderUtils.parseQuery(this.resourceQuery || '?')

      if ('lookupKey' in params) {
        if ('lookupValue' in params) {
          const key = params.lookupKey

          let value = params.lookupValue

          // try to coerce value to match common YAML types

          if (value === 'true') {
            value = true
          } else if (value === 'false') {
            value = false
          } else if (value === 'null') {
            value = null
          } else if (
            typeof value === 'string' &&
            !isNaN(value) &&
            value.trim() !== ''
          ) {
            value = Number(value)
          }

          if (Array.isArray(data)) {
            data = data.filter((item) => item && item[key] === value)
          } else {
            data = data && data[key] === value ? data : null
          }
        } else {
          const key = params.lookupKey

          if (Array.isArray(data)) {
            data = data.map((item) => (item ? item[key] : undefined))
          } else {
            data = data ? data[key] : undefined
          }
        }
      }
    }

    return [`const data = ${uneval(data)};`, 'module.exports = data;'].join(
      '\n'
    )
  } catch (err) {
    this.emitError(err)

    return null
  }
}
