const { ungzip } = require('pako')

/**
 * Webpack loader function for gzipped JSON files
 *
 * This loader decompresses gzipped JSON files and parses them as JavaScript objects.
 * It allows importing .json.gz files directly in the codebase.
 *
 * Usage:
 * import data from './file.json.gz'
 *
 * @param {Buffer} source - The gzipped file content as a buffer
 * @returns {string} - JavaScript module exporting the parsed JSON data
 */
module.exports = function jsonGzLoader(source) {
  this.cacheable && this.cacheable()

  try {
    const uint8Array = new Uint8Array(source)

    const decompressed = ungzip(uint8Array)

    const jsonString = new TextDecoder().decode(decompressed)

    const data = JSON.parse(jsonString)

    // @note use compact format for large files to avoid bundle size issues

    return `export default ${JSON.stringify(data)};`
  } catch (err) {
    this.emitError(err)

    return null
  }
}

/**
 * @note deliberately using CommonJS exports because the raw flag is not
 * detected when using ES module export syntax in webpack loaders
 */
module.exports.raw = true
