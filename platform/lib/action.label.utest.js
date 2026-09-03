import { humanizeActionName } from '@/lib/action.label'

describe('action.label', () => {
  describe('humanizeActionName', () => {
    it('should humanize snake_case names', () => {
      expect(humanizeActionName('some_function')).toBe('Some function')
      expect(humanizeActionName('get_weather_forecast')).toBe(
        'Get weather forecast'
      )
    })

    it('should humanize camelCase names', () => {
      expect(humanizeActionName('someFunction')).toBe('Some function')
      expect(humanizeActionName('getWeatherForecast')).toBe(
        'Get weather forecast'
      )
    })

    it('should humanize PascalCase names', () => {
      expect(humanizeActionName('SomeFunction')).toBe('Some function')
    })

    it('should humanize kebab-case names', () => {
      expect(humanizeActionName('some-function')).toBe('Some function')
    })

    it('should split acronym boundaries', () => {
      expect(humanizeActionName('getWeatherAPI')).toBe('Get weather api')
      expect(humanizeActionName('parseHTMLDocument')).toBe(
        'Parse html document'
      )
    })

    it('should capitalize a single word', () => {
      expect(humanizeActionName('search')).toBe('Search')
    })

    it('should collapse repeated separators and whitespace', () => {
      expect(humanizeActionName('some___function')).toBe('Some function')
      expect(humanizeActionName('  some_function  ')).toBe('Some function')
    })

    it('should handle empty and non-string input', () => {
      expect(humanizeActionName('')).toBe('')
      // @ts-expect-error testing non-string input
      expect(humanizeActionName(undefined)).toBe('')
      // @ts-expect-error testing non-string input
      expect(humanizeActionName(null)).toBe('')
    })
  })
})
