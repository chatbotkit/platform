export const sync = (path, options) => {
  if (/^(msw|@mswjs\/interceptors)(\/|$)/.test(path)) {
    return options.defaultResolver(path, { ...options, conditions: [] })
  }

  // @note the jsdom environment resolves the `browser` export condition, which
  // for the AWS SDK points at ESM-only builds that jest cannot parse. The SDK
  // only ever runs server-side here, so its node builds are used instead.
  if (/^(@aws-sdk|@smithy)\//.test(path)) {
    return options.defaultResolver(path, {
      ...options,
      conditions: (options.conditions ?? []).filter((c) => c !== 'browser'),
    })
  }

  // @note React Email rendering is server-side even when the template tests
  // use jsdom, so resolve its node implementation instead of the browser one
  if (path === '@react-email/render') {
    return options.defaultResolver(path, {
      ...options,
      conditions: (options.conditions ?? []).filter((c) => c !== 'browser'),
    })
  }

  // @note the AgentOS packages export only an `import` entry with no
  // `default`, so the CommonJS resolver cannot see them; they are transformed
  // to CommonJS anyway (see jest.utest.config.js), so ask for the ESM entry
  if (/^(@rivet-dev\/agentos-|@agentos-software\/|@rivetkit\/)/.test(path)) {
    return options.defaultResolver(path, {
      ...options,
      conditions: [
        'import',
        ...(options.conditions ?? []).filter((c) => c !== 'browser'),
      ],
    })
  }

  // @note try to resolve source files when JavaScript imports fail. This
  // handles cases where a .js request points at a .ts/.jsx/.tsx source file.
  try {
    return options.defaultResolver(path, options)
  } catch (error) {
    // if the path ends with .js or .jsx, try .ts or .tsx

    if (path.endsWith('.js')) {
      try {
        return options.defaultResolver(path.replace(/\.js$/, '.ts'), options)
      } catch {
        // fall through to original error
      }

      try {
        return options.defaultResolver(path.replace(/\.js$/, '.jsx'), options)
      } catch {
        // fall through to original error
      }

      try {
        return options.defaultResolver(path.replace(/\.js$/, '.tsx'), options)
      } catch {
        // fall through to original error
      }
    } else if (path.endsWith('.jsx')) {
      try {
        return options.defaultResolver(path.replace(/\.jsx$/, '.tsx'), options)
      } catch {
        // fall through to original error
      }
    }

    throw error
  }
}
