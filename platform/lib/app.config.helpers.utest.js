/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getAppConfig,
  getPublicConfig,
  getShadowConfig,
  getUserConfig,
  userInConfig,
  userMatchesRef,
} from '@/lib/app.config.helpers'

describe('getUserConfig', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  }

  const mockUserWithDifferentDomain = {
    id: 'user456',
    email: 'test@different.com',
  }

  describe('Direct user configurations', () => {
    it('should return null when no user configs exist', () => {
      const config = {}

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should return null when user configs exist but user is not found', () => {
      const config = {
        users: {
          otherUser: { apps: { app1: { setting: 'value' } } },
        },
      }

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should match user by exact ID', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'value' } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'value' } } })
    })

    it('should match user by exact email', () => {
      const config = {
        users: {
          'test@example.com': { apps: { app1: { setting: 'value' } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'value' } } })
    })

    it('should match user by domain (@example.com)', () => {
      const config = {
        users: {
          '@example.com': { apps: { app1: { setting: 'domain' } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'domain' } } })
    })

    it('should match user by wildcard domain (*@example.com)', () => {
      const config = {
        users: {
          '*@example.com': { apps: { app1: { setting: 'wildcard' } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'wildcard' } } })
    })

    it('should match user by global wildcard (*)', () => {
      const config = {
        users: {
          '*': { apps: { app1: { setting: 'global' } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'global' } } })
    })

    it('should merge multiple matching user configs with correct priority', () => {
      const config = {
        users: {
          '*': {
            apps: {
              app1: { setting1: 'global', priority: 'low' },
              app2: { setting: 'global' },
            },
          },
          '@example.com': {
            apps: { app1: { setting2: 'domain' }, app3: { setting: 'domain' } },
          },
          user123: {
            apps: {
              app1: { setting1: 'specific' },
              app4: { setting: 'specific' },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: { setting1: 'specific', setting2: 'domain', priority: 'low' },
          app2: { setting: 'global' },
          app3: { setting: 'domain' },
          app4: { setting: 'specific' },
        },
      })
    })

    it('should handle nested config merging', () => {
      const config = {
        users: {
          '*': {
            apps: {
              app1: {
                features: { feature1: true, feature2: false },
                settings: { theme: 'dark' },
              },
            },
          },
          user123: {
            apps: {
              app1: {
                features: { feature2: true, feature3: true },
                settings: { language: 'en' },
              },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: {
            features: { feature1: true, feature2: true, feature3: true },
            settings: { theme: 'dark', language: 'en' },
          },
        },
      })
    })
  })

  describe('Group configurations', () => {
    it('should return null when user has no direct config and groups exist but user not in groups', () => {
      const config = {
        groups: {
          group1: {
            apps: { app1: { setting: 'group' } },
            users: {
              otherUser: { apps: { app2: { setting: 'other' } } },
            },
          },
        },
      }

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should ignore group configs when user has no direct config (per comment logic)', () => {
      const config = {
        groups: {
          group1: {
            apps: { app1: { setting: 'group' } },
            users: {
              user123: { apps: { app2: { setting: 'user' } } },
            },
          },
        },
      }

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should include group configs when user has direct config', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct' } } },
        },
        groups: {
          group1: {
            apps: { app2: { setting: 'group' } },
            users: {
              user123: { apps: { app3: { setting: 'groupUser' } } },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: { setting: 'direct' },
          app2: { setting: 'group' },
          app3: { setting: 'groupUser' },
        },
      })
    })

    it('should match user in groups by all matching patterns', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct' } } },
        },
        groups: {
          group1: {
            apps: { app2: { setting: 'group1' } },
            users: {
              '*': { apps: { app3: { setting: 'wildcard' } } },
            },
          },
          group2: {
            apps: { app4: { setting: 'group2' } },
            users: {
              'test@example.com': { apps: { app5: { setting: 'email' } } },
            },
          },
          group3: {
            apps: { app6: { setting: 'group3' } },
            users: {
              '@example.com': { apps: { app7: { setting: 'domain' } } },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: { setting: 'direct' },
          app2: { setting: 'group1' },
          app3: { setting: 'wildcard' },
          app4: { setting: 'group2' },
          app5: { setting: 'email' },
          app6: { setting: 'group3' },
          app7: { setting: 'domain' },
        },
      })
    })

    it('should properly exclude users property from group config when merging', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct' } } },
        },
        groups: {
          group1: {
            apps: { app2: { setting: 'group' } },
            customGroupProperty: 'shouldBeIncluded',
            users: {
              user123: { apps: { app3: { setting: 'groupUser' } } },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: { setting: 'direct' },
          app2: { setting: 'group' },
          app3: { setting: 'groupUser' },
        },
        customGroupProperty: 'shouldBeIncluded',
      })

      expect(result).not.toHaveProperty('users')
    })

    it('should handle multiple groups with same user', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct' } } },
        },
        groups: {
          group1: {
            apps: { app2: { priority: 'low' } },
            users: {
              user123: { apps: { app2: { setting: 'group1user' } } },
            },
          },
          group2: {
            apps: { app2: { priority: 'medium' } },
            users: {
              user123: { apps: { app2: { setting: 'group2user' } } },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result?.apps?.app2).toEqual({
        priority: 'medium',
        setting: 'group2user',
      })
    })
  })

  describe('Merge priority and behavior', () => {
    it('should prioritize direct user configs over group configs', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct', priority: 'user' } } },
        },
        groups: {
          group1: {
            apps: { app1: { setting: 'group', priority: 'group' } },
            users: {
              user123: {
                apps: { app1: { setting: 'groupUser', priority: 'groupUser' } },
              },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: { app1: { setting: 'direct', priority: 'user' } },
      })
    })

    it('should merge configs with complex nested structures', () => {
      const config = {
        users: {
          '*': {
            apps: {
              app1: {
                global: { setting1: 'global1', setting2: 'global2' },
                shared: { value: 'fromGlobal' },
              },
            },
            globalProperty: 'global',
          },
          user123: {
            apps: {
              app1: {
                user: { setting1: 'user1' },
                shared: { value: 'fromUser', extra: 'userExtra' },
              },
            },
            userProperty: 'user',
          },
        },
        groups: {
          group1: {
            apps: {
              app1: {
                group: { setting1: 'group1' },
                shared: { value: 'fromGroup' },
              },
            },
            groupProperty: 'group',
            users: {
              user123: {
                apps: {
                  app1: {
                    groupUser: { setting1: 'groupUser1' },
                    shared: { value: 'fromGroupUser' },
                  },
                },
                groupUserProperty: 'groupUser',
              },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: {
            global: { setting1: 'global1', setting2: 'global2' },
            group: { setting1: 'group1' },
            groupUser: { setting1: 'groupUser1' },
            user: { setting1: 'user1' },
            shared: { value: 'fromUser', extra: 'userExtra' },
          },
        },
        globalProperty: 'global',
        groupProperty: 'group',
        groupUserProperty: 'groupUser',
        userProperty: 'user',
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle email with empty domain', () => {
      const userWithEmptyDomain = { id: 'user123', email: 'test@' }

      const config = {
        users: {
          '@': { apps: { app1: { setting: 'empty' } } },
        },
      }

      const result = getUserConfig(userWithEmptyDomain, config)

      expect(result).toEqual(null)
    })

    it('should handle email without @ symbol gracefully', () => {
      const userWithoutAt = { id: 'user123', email: 'invalid-email' }

      const config = {
        users: {
          user123: { apps: { app1: { setting: 'value' } } },
          '@undefined': { apps: { app2: { setting: 'should-not-match' } } },
        },
      }

      const result = getUserConfig(userWithoutAt, config)

      expect(result).toEqual({ apps: { app1: { setting: 'value' } } })
    })

    it('should handle undefined/null config properties', () => {
      const config = {
        users: undefined,
        groups: undefined,
      }

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should handle empty config objects', () => {
      const config = {
        users: {},
        groups: {},
      }

      expect(getUserConfig(mockUser, config)).toBeNull()
    })

    it('should handle groups without users property', () => {
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'direct' } } },
        },
        groups: {
          group1: {
            apps: { app2: { setting: 'group' } },
            // no users property
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ apps: { app1: { setting: 'direct' } } })
    })

    it('should handle user configs without apps property', () => {
      const config = {
        users: {
          user123: { customProperty: 'value' }, // no apps property
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({ customProperty: 'value' })
    })

    it('should handle empty arrays and objects in merge', () => {
      const config = {
        users: {
          user123: {
            apps: {
              app1: {
                emptyArray: [],
                emptyObject: {},
                nullValue: null,
                undefinedValue: undefined,
              },
            },
          },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: {
            emptyArray: [],
            emptyObject: {},
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      })
    })
  })

  describe('Multiple users and domains', () => {
    it('should not match users from different domains', () => {
      const config = {
        users: {
          '@example.com': { apps: { app1: { setting: 'example' } } },
          '*@example.com': { apps: { app2: { setting: 'example-wildcard' } } },
        },
      }

      expect(getUserConfig(mockUserWithDifferentDomain, config)).toBeNull()
    })

    it('should handle multiple domain wildcards correctly', () => {
      const config = {
        users: {
          '*@example.com': { apps: { app1: { setting: 'example' } } },
          '*@different.com': { apps: { app1: { setting: 'different' } } },
          '*': { apps: { app2: { setting: 'global' } } },
        },
      }

      const resultExample = getUserConfig(mockUser, config)

      expect(resultExample).toEqual({
        apps: {
          app1: { setting: 'example' },
          app2: { setting: 'global' },
        },
      })

      const resultDifferent = getUserConfig(mockUserWithDifferentDomain, config)

      expect(resultDifferent).toEqual({
        apps: {
          app1: { setting: 'different' },
          app2: { setting: 'global' },
        },
      })
    })

    it('should handle complex domain matching scenarios', () => {
      const config = {
        users: {
          '*': { apps: { app1: { global: true } } },
          '@example.com': { apps: { app1: { domain: true } } },
          '*@example.com': { apps: { app1: { domainWildcard: true } } },
          'test@example.com': { apps: { app1: { email: true } } },
          user123: { apps: { app1: { id: true } } },
        },
      }

      const result = getUserConfig(mockUser, config)

      expect(result).toEqual({
        apps: {
          app1: {
            global: true,
            domain: true,
            domainWildcard: true,
            email: true,
            id: true,
          },
        },
      })
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle a comprehensive real-world configuration', () => {
      const config = {
        users: {
          '*': {
            apps: {
              analytics: { enabled: false },
              notifications: { email: true, push: false },
            },
          },
          '@company.com': {
            apps: {
              analytics: { enabled: true, level: 'basic' },
              collaboration: { enabled: true },
            },
          },
          'admin@company.com': {
            apps: {
              analytics: { level: 'advanced', debug: true },
              admin: { enabled: true },
            },
          },
        },
        groups: {
          engineering: {
            apps: {
              development: { enabled: true },
              analytics: { customEvents: true },
            },
            users: {
              'test@company.com': {
                apps: {
                  development: { debugMode: true },
                  analytics: { sampling: 0.1 },
                },
              },
            },
          },
          management: {
            apps: {
              reports: { enabled: true },
              analytics: { dashboards: true },
            },
            users: {
              '@company.com': {
                apps: {
                  reports: { access: 'full' },
                },
              },
            },
          },
        },
      }

      const engineerUser = { id: 'eng123', email: 'test@company.com' }

      const result = getUserConfig(engineerUser, config)

      expect(result).toEqual({
        apps: {
          analytics: {
            enabled: true,
            level: 'basic',
            customEvents: true,
            dashboards: true,
            sampling: 0.1,
          },
          notifications: { email: true, push: false },
          collaboration: { enabled: true },
          development: { enabled: true, debugMode: true },
          reports: { enabled: true, access: 'full' },
        },
      })
    })
  })
})

describe('userMatchesRef', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  }

  describe('Wildcard matching', () => {
    it('should match wildcard "*"', () => {
      expect(userMatchesRef(mockUser, '*')).toBe(true)
    })

    it('should match wildcard even with empty user', () => {
      expect(userMatchesRef({}, '*')).toBe(true)
    })
  })

  describe('ID matching', () => {
    it('should match exact user ID', () => {
      expect(userMatchesRef(mockUser, 'user123')).toBe(true)
    })

    it('should not match different user ID', () => {
      expect(userMatchesRef(mockUser, 'user456')).toBe(false)
    })

    it('should handle user without ID', () => {
      expect(userMatchesRef({ email: 'test@example.com' }, 'user123')).toBe(
        false
      )
    })

    it('should handle empty ID', () => {
      expect(userMatchesRef({ id: '', email: 'test@example.com' }, '')).toBe(
        false
      )
    })
  })

  describe('Email matching', () => {
    it('should match exact email', () => {
      expect(userMatchesRef(mockUser, 'test@example.com')).toBe(true)
    })

    it('should not match different email', () => {
      expect(userMatchesRef(mockUser, 'other@example.com')).toBe(false)
    })

    it('should handle user without email', () => {
      expect(userMatchesRef({ id: 'user123' }, 'test@example.com')).toBe(false)
    })
  })

  describe('Domain matching', () => {
    it('should match domain with @ prefix', () => {
      expect(userMatchesRef(mockUser, '@example.com')).toBe(true)
    })

    it('should match domain with *@ prefix', () => {
      expect(userMatchesRef(mockUser, '*@example.com')).toBe(true)
    })

    it('should not match different domain', () => {
      expect(userMatchesRef(mockUser, '@other.com')).toBe(false)
      expect(userMatchesRef(mockUser, '*@other.com')).toBe(false)
    })
  })

  describe('Edge cases and potential bugs', () => {
    it('should handle email without @ symbol', () => {
      const userWithoutAt = { id: 'user123', email: 'invalid-email' }

      expect(userMatchesRef(userWithoutAt, '@domain.com')).toBe(false)
      expect(userMatchesRef(userWithoutAt, '*@domain.com')).toBe(false)
    })

    it('should handle email with empty domain', () => {
      const userWithEmptyDomain = { id: 'user123', email: 'test@' }

      expect(userMatchesRef(userWithEmptyDomain, '@')).toBe(false)
      expect(userMatchesRef(userWithEmptyDomain, '*@')).toBe(false)
    })

    it('should handle email with whitespace in domain', () => {
      const userWithWhitespaceDomain = {
        id: 'user123',
        email: 'test@ example.com ',
      }

      expect(userMatchesRef(userWithWhitespaceDomain, '@example.com')).toBe(
        true
      )
      expect(userMatchesRef(userWithWhitespaceDomain, '*@example.com')).toBe(
        true
      )
    })

    it('should handle multiple @ symbols in email', () => {
      const userWithMultipleAt = {
        id: 'user123',
        email: 'test@sub@example.com',
      }

      expect(userMatchesRef(userWithMultipleAt, '@sub@example.com')).toBe(true)
      expect(userMatchesRef(userWithMultipleAt, '*@sub@example.com')).toBe(true)
    })

    it('should handle empty email', () => {
      const userWithEmptyEmail = { id: 'user123', email: '' }

      expect(userMatchesRef(userWithEmptyEmail, '@example.com')).toBe(false)
      expect(userMatchesRef(userWithEmptyEmail, '*@example.com')).toBe(false)
    })

    it('should handle undefined email', () => {
      const userWithUndefinedEmail = { id: 'user123', email: undefined }

      expect(userMatchesRef(userWithUndefinedEmail, '@example.com')).toBe(false)
      expect(userMatchesRef(userWithUndefinedEmail, '*@example.com')).toBe(
        false
      )
    })

    it('should return false for no matches', () => {
      expect(userMatchesRef(mockUser, 'nomatch')).toBe(false)
      expect(userMatchesRef(mockUser, '@nomatch.com')).toBe(false)
      expect(userMatchesRef(mockUser, '*@nomatch.com')).toBe(false)
    })
  })
})

describe('userInConfig', () => {
  const mockUser = {
    id: 'user123',
    email: 'test@example.com',
  }

  it('should return true when user exists in config', () => {
    const config = {
      users: {
        user123: { apps: { app1: { setting: 'value' } } },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(true)
  })

  it('should return false when user does not exist in config', () => {
    const config = {
      users: {
        otherUser: { apps: { app1: { setting: 'value' } } },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(false)
  })

  it('should return false when config is empty', () => {
    const config = {}

    expect(userInConfig(mockUser, config)).toBe(false)
  })

  it('should return true when user matches by email', () => {
    const config = {
      users: {
        'test@example.com': { apps: { app1: { setting: 'value' } } },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(true)
  })

  it('should return true when user matches by domain', () => {
    const config = {
      users: {
        '@example.com': { apps: { app1: { setting: 'value' } } },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(true)
  })

  it('should return true when user matches by wildcard', () => {
    const config = {
      users: {
        '*': { apps: { app1: { setting: 'value' } } },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(true)
  })

  it('should ignore group configs when user has no direct config', () => {
    const config = {
      groups: {
        group1: {
          apps: { app1: { setting: 'group' } },
          users: {
            user123: { apps: { app2: { setting: 'user' } } },
          },
        },
      },
    }

    expect(userInConfig(mockUser, config)).toBe(false)
  })
})

describe('getShadowConfig', () => {
  it('should return _ property when it exists', () => {
    const config = {
      name: 'test',
      _: {
        shadowProperty: 'shadowValue',
        apps: {
          app1: { shadowSetting: 'value' },
        },
      },
    }

    const result = getShadowConfig(config)

    expect(result).toEqual({
      shadowProperty: 'shadowValue',
      apps: {
        app1: { shadowSetting: 'value' },
      },
    })
  })

  it('should return null _ property does not exist', () => {
    const config = {
      name: 'test',
      apps: { app1: { setting: 'value' } },
    }

    const result = getShadowConfig(config)

    expect(result).toEqual(null)
  })

  it('should return null when _ property is null', () => {
    const config = {
      name: 'test',
      _: null,
    }

    const result = getShadowConfig(config)

    expect(result).toEqual(null)
  })

  it('should return null object when _ property is undefined', () => {
    const config = {
      name: 'test',
      _: undefined,
    }

    const result = getShadowConfig(config)

    expect(result).toEqual(null)
  })

  it('should handle empty config object', () => {
    const config = {}

    const result = getShadowConfig(config)

    expect(result).toEqual(null)
  })
})

describe('getPublicConfig', () => {
  it('should return common config properties', () => {
    const config = {
      name: 'Test App',
      headline: 'Test Headline',
      description: 'Test Description',
      hidden: true,
      apps: {
        app1: {
          icon: 'icon1',
          name: 'App 1',
          headline: 'App 1 Headline',
          description: 'App 1 Description',
          hidden: true,
          sidebar: true,
          extraProp: 'should not be included',
        },
      },
      layout: { theme: 'dark' },
      auth: { provider: 'oauth' },
      analytics: { enabled: true },
      home: { route: '/' },
      extraProp: 'should not be included',
    }

    const result = getPublicConfig(config)

    expect(result).toEqual({
      name: 'Test App',
      headline: 'Test Headline',
      description: 'Test Description',
      hidden: true,
      apps: {
        app1: {
          icon: 'icon1',
          name: 'App 1',
          headline: 'App 1 Headline',
          description: 'App 1 Description',
          hidden: true,
          sidebar: true,
        },
      },
      layout: { theme: 'dark' },
      analytics: { enabled: true },
      home: { route: '/' },
    })
  })

  it('should merge shadow config with main config', () => {
    const config = {
      name: 'Test App',
      apps: {
        app1: {
          name: 'App 1',
          headline: 'Main Headline',
        },
      },
      _: {
        apps: {
          app1: {
            icon: 'shadow-icon',
            description: 'Shadow Description',
            hidden: true,
            headline: 'Shadow Headline', // should be overridden
          },
        },
      },
    }

    const result = getPublicConfig(config)

    expect(result.apps.app1).toEqual({
      icon: 'shadow-icon',
      name: 'App 1',
      headline: 'Main Headline', // main config should override shadow
      description: 'Shadow Description',
      hidden: true,
      sidebar: undefined,
    })
  })

  it('should handle missing apps property', () => {
    const config = {
      name: 'Test App',
      layout: { theme: 'light' },
    }

    const result = getPublicConfig(config)

    expect(result.apps).toEqual({})
  })

  it('should handle empty apps object', () => {
    const config = {
      name: 'Test App',
      apps: {},
    }

    const result = getPublicConfig(config)

    expect(result.apps).toEqual({})
  })

  it('should handle config without shadow', () => {
    const config = {
      name: 'Test App',
      apps: {
        app1: {
          name: 'App 1',
        },
      },
    }

    const result = getPublicConfig(config)

    expect(result.apps.app1).toEqual({
      icon: undefined,
      name: 'App 1',
      headline: undefined,
      description: undefined,
      hidden: undefined,
      sidebar: undefined,
    })
  })

  it('should keep the Static app hidden by default when configured', () => {
    const result = getPublicConfig({
      apps: {
        static: {},
      },
    })

    expect(result.apps.static).toMatchObject({
      category: 'main',
      hidden: true,
      name: 'Static',
    })
  })

  it('should handle undefined config properties', () => {
    const config = {
      name: undefined,
      headline: null,
      apps: {
        app1: {
          icon: null,
          name: undefined,
          hidden: true,
        },
      },
    }

    const result = getPublicConfig(config)

    expect(result).toEqual({
      name: undefined,
      headline: null,
      description: undefined,
      apps: {
        app1: {
          icon: null,
          name: undefined,
          headline: undefined,
          description: undefined,
          hidden: true,
          sidebar: undefined,
        },
      },
      layout: undefined,
      auth: undefined,
      analytics: undefined,
      home: undefined,
    })
  })
})

describe('getAppConfig', () => {
  it('should return merged app config', () => {
    const config = {
      apps: {
        app1: {
          name: 'App 1',
          setting1: 'main',
          setting2: 'main',
        },
      },
      _: {
        apps: {
          app1: {
            icon: 'shadow-icon',
            setting1: 'shadow', // should be overridden
            setting3: 'shadow',
          },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      icon: 'shadow-icon',
      name: 'App 1',
      setting1: 'main', // main config should override shadow
      setting2: 'main',
      setting3: 'shadow',
    })
  })

  it('should return app config without shadow', () => {
    const config = {
      apps: {
        app1: {
          name: 'App 1',
          setting: 'value',
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      name: 'App 1',
      setting: 'value',
    })
  })

  it('should return shadow config when app does not exist in main config', () => {
    const config = {
      apps: {},
      _: {
        apps: {
          app1: {
            icon: 'shadow-icon',
            name: 'Shadow App',
          },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      icon: 'shadow-icon',
      name: 'Shadow App',
    })
  })

  it('should return null when app does not exist anywhere', () => {
    const config = {
      apps: {
        app2: { name: 'Other App' },
      },
      _: {
        apps: {
          app2: { icon: 'other-icon' },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual(null)
  })

  it('should handle missing apps property in main config', () => {
    const config = {
      name: 'Test Config',
      _: {
        apps: {
          app1: {
            name: 'Shadow App',
          },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      name: 'Shadow App',
    })
  })

  it('should handle missing apps property in shadow config', () => {
    const config = {
      apps: {
        app1: {
          name: 'Main App',
        },
      },
      _: {},
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      name: 'Main App',
    })
  })

  it('should handle null and undefined values', () => {
    const config = {
      apps: {
        app1: {
          name: null,
          setting1: undefined,
          setting2: 'main',
        },
      },
      _: {
        apps: {
          app1: {
            name: 'shadow',
            setting1: 'shadow',
            setting3: null,
          },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      name: null, // null from main should override shadow
      setting1: undefined, // undefined from main should override shadow
      setting2: 'main',
      setting3: null,
    })
  })

  it('should handle complex nested objects', () => {
    const config = {
      apps: {
        app1: {
          features: {
            feature1: true,
            feature2: { enabled: true, config: 'main' },
          },
          settings: {
            theme: 'dark',
          },
        },
      },
      _: {
        apps: {
          app1: {
            features: {
              feature2: { enabled: false, timeout: 1000 },
              feature3: true,
            },
            settings: {
              language: 'en',
              theme: 'light', // should be overridden
            },
          },
        },
      },
    }

    const result = getAppConfig(config, 'app1')

    expect(result).toEqual({
      features: {
        feature1: true,
        feature2: { enabled: true, config: 'main', timeout: 1000 },
        feature3: true,
      },
      settings: {
        theme: 'dark', // main overrides shadow
        language: 'en',
      },
    })
  })
})

describe('Integration tests and edge cases', () => {
  describe('Function interactions', () => {
    it('should work correctly when userInConfig and getUserConfig disagree (should not happen)', () => {
      const mockUser = { id: 'user123', email: 'test@example.com' }
      const config = {
        users: {
          user123: { apps: { app1: { setting: 'value' } } },
        },
      }

      expect(userInConfig(mockUser, config)).toBe(true)
      expect(getUserConfig(mockUser, config)).not.toBeNull()
    })

    it('should handle getPublicConfig and getAppConfig with consistent behavior', () => {
      const config = {
        name: 'Test Config',
        apps: {
          app1: { name: 'App 1', setting: 'main' },
          app2: { name: 'App 2' },
        },
        _: {
          apps: {
            app1: { icon: 'icon1', setting: 'shadow' },
            app2: { icon: 'icon2' },
          },
        },
      }

      const common = getPublicConfig(config)
      const app1 = getAppConfig(config, 'app1')
      const app2 = getAppConfig(config, 'app2')

      expect(common.apps.app1).toEqual({
        icon: 'icon1',
        name: 'App 1',
        headline: undefined,
        description: undefined,
        sidebar: undefined,
      })

      expect(app1).toEqual({
        icon: 'icon1',
        name: 'App 1',
        setting: 'main', // main overrides shadow
      })

      expect(app2).toEqual({
        icon: 'icon2',
        name: 'App 2',
      })
    })
  })

  describe('Memory and performance considerations', () => {
    it('should handle large configurations efficiently', () => {
      const largeConfig = {
        users: {},
        groups: {},
      }

      for (let i = 0; i < 100; i++) {
        largeConfig.users[`user${i}`] = {
          apps: {
            [`app${i}`]: { setting: `value${i}` },
          },
        }
      }

      for (let g = 0; g < 10; g++) {
        largeConfig.groups[`group${g}`] = {
          apps: { [`groupApp${g}`]: { setting: `groupValue${g}` } },
          users: {},
        }

        for (let u = 0; u < 10; u++) {
          largeConfig.groups[`group${g}`].users[`user${u}`] = {
            apps: {
              [`groupUserApp${g}_${u}`]: { setting: `groupUserValue${g}_${u}` },
            },
          }
        }
      }

      const testUser = { id: 'user50', email: 'user50@example.com' }

      const start = performance.now()
      const result = getUserConfig(testUser, largeConfig)
      const end = performance.now()

      expect(result).not.toBeNull()
      expect(result?.apps).toHaveProperty('app50')
      expect(end - start).toBeLessThan(10) // Should be fast
    })
  })

  describe('Regression tests for specific bugs', () => {
    it('should handle domain extraction correctly with multiple @ symbols (bug fix)', () => {
      const user = { id: 'test', email: 'test@sub@example.com' }

      expect(userMatchesRef(user, '@sub@example.com')).toBe(true)
      expect(userMatchesRef(user, '*@sub@example.com')).toBe(true)
      expect(userMatchesRef(user, '@example.com')).toBe(false)
      expect(userMatchesRef(user, '*@example.com')).toBe(false)
    })

    it('should handle empty strings and falsy values correctly', () => {
      const emptyUser = { id: '', email: '' }

      expect(userMatchesRef(emptyUser, '')).toBe(false) // empty ID should not match empty string
      expect(userMatchesRef(emptyUser, '@')).toBe(false) // empty domain should not match
      expect(userMatchesRef(emptyUser, '*')).toBe(true) // wildcard should still match
    })

    it('should handle extremely long email addresses', () => {
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com'
      const user = { id: 'test', email: longEmail }
      const expectedDomain = 'b'.repeat(100) + '.com'

      expect(userMatchesRef(user, longEmail)).toBe(true) // exact match
      expect(userMatchesRef(user, `@${expectedDomain}`)).toBe(true) // domain match
      expect(userMatchesRef(user, `*@${expectedDomain}`)).toBe(true) // wildcard domain match
    })

    it('should handle special characters in email addresses', () => {
      const specialUser = { id: 'test', email: 'test+tag@example-domain.co.uk' }

      expect(userMatchesRef(specialUser, 'test+tag@example-domain.co.uk')).toBe(
        true
      )
      expect(userMatchesRef(specialUser, '@example-domain.co.uk')).toBe(true)
      expect(userMatchesRef(specialUser, '*@example-domain.co.uk')).toBe(true)
    })

    it('should maintain config immutability during operations', () => {
      const originalConfig = {
        users: {
          user123: { apps: { app1: { setting: 'original' } } },
        },
        groups: {
          group1: {
            apps: { app2: { setting: 'original' } },
            users: { user123: { apps: { app3: { setting: 'original' } } } },
          },
        },
      }

      const configCopy = JSON.parse(JSON.stringify(originalConfig))
      const user = { id: 'user123', email: 'test@example.com' }

      getUserConfig(user, originalConfig)
      userInConfig(user, originalConfig)

      expect(originalConfig).toEqual(configCopy)
    })
  })
})
