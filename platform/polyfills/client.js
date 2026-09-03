import 'core-js/actual/array/at'
import 'core-js/actual/array/find-last'
import 'core-js/actual/array/find-last-index'
import 'core-js/actual/clear-immediate'
import 'core-js/actual/set-immediate'
import 'core-js/actual/string/replace-all'
import 'core-js/actual/string/starts-with'

import '@formatjs/intl-relativetimeformat/locale-data/en'
import '@formatjs/intl-relativetimeformat/polyfill'

if (typeof window !== 'undefined') {
  // @todo check why polyfill is not working
  {
    // @note implement a custom polyfill for findLast
    if (!Array.prototype.findLast) {
      Array.prototype.findLast = function (callback, thisArg) {
        if (typeof callback !== 'function') {
          throw new TypeError(callback + ' is not a function')
        }

        let length = this.length

        for (let i = length - 1; i >= 0; i--) {
          if (callback.call(thisArg, this[i], i, this)) {
            return this[i]
          }
        }

        return undefined
      }
    }

    // @note implement a custom polyfill for findLastIndex
    if (!Array.prototype.findLastIndex) {
      Array.prototype.findLastIndex = function (callback, thisArg) {
        if (typeof callback !== 'function') {
          throw new TypeError(callback + ' is not a function')
        }

        let length = this.length

        for (let i = length - 1; i >= 0; i--) {
          if (callback.call(thisArg, this[i], i, this)) {
            return i
          }
        }

        return -1
      }
    }
  }
}
