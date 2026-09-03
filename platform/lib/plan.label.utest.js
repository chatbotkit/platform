import { formatPlanLabel } from './plan.label'

describe('plan.label', () => {
  describe('formatPlanLabel', () => {
    it('should label the structural plans', () => {
      expect(formatPlanLabel('free')).toBe('Free')
      expect(formatPlanLabel('trial')).toBe('Trial')
      expect(formatPlanLabel('unlimited')).toBe('Unlimited')
    })

    it('should title a plan the platform has never heard of', () => {
      expect(formatPlanLabel('pro')).toBe('Pro')
      expect(formatPlanLabel('proPlus')).toBe('Pro Plus')
      expect(formatPlanLabel('enterprise_plus')).toBe('Enterprise Plus')
      expect(formatPlanLabel('team-annual')).toBe('Team Annual')
    })

    it('should tolerate an empty plan name', () => {
      expect(formatPlanLabel('')).toBe('')
    })
  })
})
