const handler: ProxyHandler<object> = {
  get(_target, prop) {
    if (prop === '__esModule') {
      return true
    }

    return new Proxy(() => undefined, handler)
  },

  apply() {
    return new Proxy(() => undefined, handler)
  },
}

const prisma = new Proxy({}, handler)

export default prisma
