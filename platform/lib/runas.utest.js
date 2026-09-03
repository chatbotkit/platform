import {
  RUNAS_TEAMID_COOKIE_NAME,
  RUNAS_TEAMNAME_COOKIE_NAME,
  RUNAS_USERID_COOKIE_NAME,
  RUNAS_USERNAME_COOKIE_NAME,
} from '@/config/cookie'

import { getHeader, setHeader } from '@/lib/header'

import {
  withoutTeamAndUserRunasCookies,
  withoutUserRunasCookies,
} from './runas'

jest.mock('@/config/cookie', () => ({
  RUNAS_TEAMID_COOKIE_NAME: 'runas_teamid',
  RUNAS_TEAMNAME_COOKIE_NAME: 'runas_teamname',
  RUNAS_USERID_COOKIE_NAME: 'runas_userid',
  RUNAS_USERNAME_COOKIE_NAME: 'runas_username',
}))

jest.mock('@/lib/header', () => ({
  getHeader: jest.fn(),
  setHeader: jest.fn(),
}))

describe('runas', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('withoutTeamAndUserRunasCookies', () => {
    it('should remove all team and user runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `${RUNAS_TEAMID_COOKIE_NAME}=team123; ${RUNAS_TEAMNAME_COOKIE_NAME}=TeamName; ${RUNAS_USERID_COOKIE_NAME}=user456; ${RUNAS_USERNAME_COOKIE_NAME}=UserName; other_cookie=value`

      getHeader.mockReturnValue(cookieHeader)

      const result = await wrappedFn(mockReq, 'arg1', 'arg2')

      expect(getHeader).toHaveBeenCalledWith(mockReq, 'cookie')
      expect(setHeader).toHaveBeenCalledWith(
        mockReq,
        'cookie',
        'other_cookie=value'
      )
      expect(mockFn).toHaveBeenCalledWith(mockReq, 'arg1', 'arg2')
      expect(result).toBe('result')
    })

    it('should handle empty cookie header', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue('')

      await wrappedFn(mockReq)

      expect(setHeader).toHaveBeenCalledWith(mockReq, 'cookie', '')
      expect(mockFn).toHaveBeenCalledWith(mockReq)
    })

    it('should handle cookie header with only runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `${RUNAS_TEAMID_COOKIE_NAME}=team123; ${RUNAS_USERID_COOKIE_NAME}=user456`

      getHeader.mockReturnValue(cookieHeader)

      await wrappedFn(mockReq)

      expect(setHeader).toHaveBeenCalledWith(mockReq, 'cookie', '')
    })

    it('should preserve other cookies while removing runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `session=abc; ${RUNAS_TEAMID_COOKIE_NAME}=team123; auth=xyz; ${RUNAS_USERID_COOKIE_NAME}=user456`

      getHeader.mockReturnValue(cookieHeader)

      await wrappedFn(mockReq)

      const setHeaderCall = setHeader.mock.calls[0][2]

      expect(setHeaderCall).toContain('session=abc')
      expect(setHeaderCall).toContain('auth=xyz')
      expect(setHeaderCall).not.toContain(RUNAS_TEAMID_COOKIE_NAME)
      expect(setHeaderCall).not.toContain(RUNAS_USERID_COOKIE_NAME)
    })

    it('should pass through function arguments correctly', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = { id: 'req1' }
      const arg1 = { data: 'test' }
      const arg2 = 'string-arg'

      getHeader.mockReturnValue('cookie=value')

      await wrappedFn(mockReq, arg1, arg2)

      expect(mockFn).toHaveBeenCalledWith(mockReq, arg1, arg2)
    })

    it('should handle async function errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue('cookie=value')

      await expect(wrappedFn(mockReq)).rejects.toThrow('Test error')
    })
  })

  describe('withoutUserRunasCookies', () => {
    it('should remove only user runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `${RUNAS_TEAMID_COOKIE_NAME}=team123; ${RUNAS_TEAMNAME_COOKIE_NAME}=TeamName; ${RUNAS_USERID_COOKIE_NAME}=user456; ${RUNAS_USERNAME_COOKIE_NAME}=UserName; other_cookie=value`

      getHeader.mockReturnValue(cookieHeader)

      const result = await wrappedFn(mockReq, 'arg1')

      expect(getHeader).toHaveBeenCalledWith(mockReq, 'cookie')

      const setHeaderCall = setHeader.mock.calls[0][2]

      expect(setHeaderCall).toContain(RUNAS_TEAMID_COOKIE_NAME)
      expect(setHeaderCall).toContain(RUNAS_TEAMNAME_COOKIE_NAME)
      expect(setHeaderCall).not.toContain(RUNAS_USERID_COOKIE_NAME)
      expect(setHeaderCall).not.toContain(RUNAS_USERNAME_COOKIE_NAME)
      expect(setHeaderCall).toContain('other_cookie=value')

      expect(mockFn).toHaveBeenCalledWith(mockReq, 'arg1')
      expect(result).toBe('result')
    })

    it('should handle empty cookie header', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue('')

      await wrappedFn(mockReq)

      expect(setHeader).toHaveBeenCalledWith(mockReq, 'cookie', '')
      expect(mockFn).toHaveBeenCalledWith(mockReq)
    })

    it('should preserve team runas cookies while removing user runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `${RUNAS_TEAMID_COOKIE_NAME}=team123; ${RUNAS_USERID_COOKIE_NAME}=user456`

      getHeader.mockReturnValue(cookieHeader)

      await wrappedFn(mockReq)

      const setHeaderCall = setHeader.mock.calls[0][2]

      expect(setHeaderCall).toContain(`${RUNAS_TEAMID_COOKIE_NAME}=team123`)
      expect(setHeaderCall).not.toContain(RUNAS_USERID_COOKIE_NAME)
    })

    it('should handle cookie header with only user runas cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = `${RUNAS_USERID_COOKIE_NAME}=user456; ${RUNAS_USERNAME_COOKIE_NAME}=UserName`

      getHeader.mockReturnValue(cookieHeader)

      await wrappedFn(mockReq)

      expect(setHeader).toHaveBeenCalledWith(mockReq, 'cookie', '')
    })

    it('should pass through multiple function arguments', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = { id: 'req1' }
      const arg1 = { data: 'test' }
      const arg2 = 'string-arg'
      const arg3 = [1, 2, 3]

      getHeader.mockReturnValue('cookie=value')

      await wrappedFn(mockReq, arg1, arg2, arg3)

      expect(mockFn).toHaveBeenCalledWith(mockReq, arg1, arg2, arg3)
    })

    it('should handle async function errors', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'))
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue('cookie=value')

      await expect(wrappedFn(mockReq)).rejects.toThrow('Test error')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined cookie header', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue(undefined)

      await wrappedFn(mockReq)

      expect(mockFn).toHaveBeenCalledWith(mockReq)
    })

    it('should handle null cookie header', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutUserRunasCookies(mockFn)

      const mockReq = {}

      getHeader.mockReturnValue(null)

      await wrappedFn(mockReq)

      expect(mockFn).toHaveBeenCalledWith(mockReq)
    })

    it('should handle cookie header with malformed cookies', async () => {
      const mockFn = jest.fn().mockResolvedValue('result')
      const wrappedFn = withoutTeamAndUserRunasCookies(mockFn)

      const mockReq = {}
      const cookieHeader = 'invalid-cookie-format; =; =value; key='

      getHeader.mockReturnValue(cookieHeader)

      await wrappedFn(mockReq)

      expect(mockFn).toHaveBeenCalledWith(mockReq)
    })
  })
})
