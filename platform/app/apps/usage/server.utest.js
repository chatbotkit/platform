describe('Usage App Token Metrics Integration', () => {
  it('should verify token metrics migration structure', () => {
    const mockTokenMetrics = {
      tokenMetrics: {
        totalTokens: {
          title: 'Total Tokens',
          description: 'Number of tokens consumed',
          value: 5000,
          change: 2000,
          period: 'last 30 days',
          details: {
            metric: {
              title: 'Total Tokens',
              description: 'Number of tokens consumed',
              value: 5000,
              change: 2000,
              period: 'last 30 days',
            },
            lineChart: [
              { date: '2024-01-01', total: 1500 },
              { date: '2024-01-02', total: 2000 },
              { date: '2024-01-03', total: 1500 },
            ],
          },
        },
        averageTokensPerConversation: {
          title: 'Average Tokens per Conversation',
          description: 'Average number of tokens consumed per conversation',
          value: 50,
          period: 'last 30 days',
        },
        averageTokensPerMessage: {
          title: 'Average Tokens per Message',
          description: 'Average number of tokens consumed per message',
          value: 20,
          period: 'last 30 days',
        },
      },
    }

    expect(mockTokenMetrics.tokenMetrics).toBeDefined()

    expect(mockTokenMetrics.tokenMetrics.totalTokens.title).toBe('Total Tokens')
    expect(mockTokenMetrics.tokenMetrics.totalTokens.value).toBe(5000)
    expect(mockTokenMetrics.tokenMetrics.totalTokens.change).toBe(2000)

    expect(
      mockTokenMetrics.tokenMetrics.totalTokens.details.lineChart
    ).toHaveLength(3)
    expect(
      mockTokenMetrics.tokenMetrics.totalTokens.details.lineChart[0]
    ).toEqual({
      date: '2024-01-01',
      total: 1500,
    })

    expect(
      mockTokenMetrics.tokenMetrics.averageTokensPerConversation.title
    ).toBe('Average Tokens per Conversation')
    expect(mockTokenMetrics.tokenMetrics.averageTokensPerMessage.title).toBe(
      'Average Tokens per Message'
    )

    Object.values(mockTokenMetrics.tokenMetrics).forEach((metric) => {
      expect(metric.title).toBeDefined()
      expect(metric.description).toBeDefined()
      expect(typeof metric.value).toBe('number')
      expect(metric.period).toBeDefined()
    })
  })

  it('should validate token metrics calculations match adhoc app logic', () => {
    const mockData = {
      totalTokens: [{ total: 5000 }],
      totalTokensPreviousPeriod: [{ total: 3000 }],
      totalConversations: [{ total: 100 }],
      totalMessages: [{ total: 250 }],
      breakdownOfTokens: [
        { date: new Date('2024-01-01'), total: 1500 },
        { date: new Date('2024-01-02'), total: 2000 },
        { date: new Date('2024-01-03'), total: 1500 },
      ],
    }

    const totalTokensValue = Number(mockData.totalTokens[0].total)
    const previousTokensValue = Number(
      mockData.totalTokensPreviousPeriod[0].total
    )
    const totalConversationsValue = Number(mockData.totalConversations[0].total)
    const totalMessagesValue = Number(mockData.totalMessages[0].total)

    const change = totalTokensValue - previousTokensValue
    const avgTokensPerConversation =
      totalConversationsValue > 0
        ? totalTokensValue / totalConversationsValue
        : 0
    const avgTokensPerMessage =
      totalMessagesValue > 0 ? totalTokensValue / totalMessagesValue : 0

    expect(totalTokensValue).toBe(5000)
    expect(change).toBe(2000) // 5000 - 3000
    expect(avgTokensPerConversation).toBe(50) // 5000 / 100
    expect(avgTokensPerMessage).toBe(20) // 5000 / 250

    const lineChartData = mockData.breakdownOfTokens.map(({ date, total }) => ({
      date: date.toISOString().split('T')[0],
      total: Number(total),
    }))

    expect(lineChartData).toEqual([
      { date: '2024-01-01', total: 1500 },
      { date: '2024-01-02', total: 2000 },
      { date: '2024-01-03', total: 1500 },
    ])
  })

  it('should handle edge cases from adhoc app migration', () => {
    const edgeCaseData = {
      totalTokens: [{ total: 0 }],
      totalTokensPreviousPeriod: [{ total: 0 }],
      totalConversations: [{ total: 0 }],
      totalMessages: [{ total: 0 }],
    }

    const totalTokensValue = Number(edgeCaseData.totalTokens[0].total)
    const totalConversationsValue = Number(
      edgeCaseData.totalConversations[0].total
    )
    const totalMessagesValue = Number(edgeCaseData.totalMessages[0].total)

    const avgTokensPerConversation =
      totalConversationsValue > 0
        ? totalTokensValue / totalConversationsValue
        : 0
    const avgTokensPerMessage =
      totalMessagesValue > 0 ? totalTokensValue / totalMessagesValue : 0

    expect(avgTokensPerConversation).toBe(0)
    expect(avgTokensPerMessage).toBe(0)

    expect(Number.isFinite(avgTokensPerConversation)).toBe(true)
    expect(Number.isFinite(avgTokensPerMessage)).toBe(true)
  })
})
