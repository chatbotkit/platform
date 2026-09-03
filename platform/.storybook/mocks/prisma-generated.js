// @note CJS on purpose - module.exports is a Proxy so that any named import
// pulled from the generated prisma client (Prisma, PrismaClient, enums, etc.)
// resolves to a callable, constructable stub instead of failing at module
// evaluation time

const handler = {
  get(_target, prop) {
    if (prop === '__esModule') {
      return true
    }

    return proxy
  },

  apply() {
    return proxy
  },

  construct() {
    return proxy
  },
}

const proxy = new Proxy(function () {}, handler)

module.exports = proxy
