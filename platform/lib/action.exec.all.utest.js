/* eslint-disable @typescript-eslint/no-require-imports */
import { executeAction } from './action.exec.all'
import { ActionName } from './action.name'

jest.mock('./action.exec.abort', () => ({
  executeAbortAction: jest.fn(),
}))
jest.mock('./action.exec.agent', () => ({
  executeAgentAction: jest.fn(),
}))
jest.mock('./action.exec.attachment', () => ({
  executeAttachmentAction: jest.fn(),
}))
jest.mock('./action.exec.blueprint', () => ({
  executeBlueprintAction: jest.fn(),
}))
jest.mock('./action.exec.bot', () => ({
  executeBotAction: jest.fn(),
}))
jest.mock('./action.exec.conversation', () => ({
  executeConversationAction: jest.fn(),
}))
jest.mock('./action.exec.dataset', () => ({
  executeDatasetAction: jest.fn(),
}))
jest.mock('./action.exec.echo', () => ({
  executeEchoAction: jest.fn(),
}))
jest.mock('./action.exec.email', () => ({
  executeEmailAction: jest.fn(),
}))
jest.mock('./action.exec.fetch', () => ({
  executeFetchAction: jest.fn(),
}))
jest.mock('./action.exec.file', () => ({
  executeFileAction: jest.fn(),
}))
jest.mock('./action.exec.form', () => ({
  executeFormAction: jest.fn(),
}))
jest.mock('./action.exec.image', () => ({
  executeImageAction: jest.fn(),
}))
jest.mock('./action.exec.listen', () => ({
  executeListenAction: jest.fn(),
}))
jest.mock('./action.exec.list', () => ({
  executeListAction: jest.fn(),
}))
jest.mock('./action.exec.mcp', () => ({
  executeMcpAction: jest.fn(),
}))
jest.mock('./action.exec.memory', () => ({
  executeMemoryAction: jest.fn(),
}))
jest.mock('./action.exec.pack', () => ({
  executePackAction: jest.fn(),
}))
jest.mock('./action.exec.rating', () => ({
  executeRatingAction: jest.fn(),
}))
jest.mock('./action.exec.search', () => ({
  executeSearchAction: jest.fn(),
}))
jest.mock('./action.exec.shell', () => ({
  executeShellAction: jest.fn(),
}))
jest.mock('./action.exec.skillset', () => ({
  executeSkillsetAction: jest.fn(),
}))
jest.mock('./action.exec.space', () => ({
  executeSpaceAction: jest.fn(),
}))
jest.mock('./action.exec.task', () => ({
  executeTaskAction: jest.fn(),
}))
jest.mock('./action.exec.time', () => ({
  executeTimeAction: jest.fn(),
}))
jest.mock('./action.exec.text', () => ({
  executeTextAction: jest.fn(),
}))
jest.mock('./action.exec.view', () => ({
  executeViewAction: jest.fn(),
}))

describe('executeAction', () => {
  const defaultInput = 'test input'
  const defaultParams = { param1: 'value1' }
  const defaultOptions = { userId: 'user123' }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('action routing', () => {
    it('should route search action correctly', async () => {
      const { executeSearchAction } = require('./action.exec.search')

      executeSearchAction.mockResolvedValue({ result: 'search result' })

      const result = await executeAction(
        ActionName.search,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeSearchAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'search result' })
    })

    it('should route blueprint action correctly', async () => {
      const { executeBlueprintAction } = require('./action.exec.blueprint')

      executeBlueprintAction.mockResolvedValue({ result: 'blueprint result' })

      const result = await executeAction(
        ActionName.blueprint,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeBlueprintAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'blueprint result' })
    })

    it('should route bot action correctly', async () => {
      const { executeBotAction } = require('./action.exec.bot')

      executeBotAction.mockResolvedValue({ result: 'bot result' })

      const result = await executeAction(
        ActionName.bot,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeBotAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'bot result' })
    })

    it('should route dataset action correctly', async () => {
      const { executeDatasetAction } = require('./action.exec.dataset')

      executeDatasetAction.mockResolvedValue({ result: 'dataset result' })

      const result = await executeAction(
        ActionName.dataset,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeDatasetAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'dataset result' })
    })

    it('should route skillset action correctly', async () => {
      const { executeSkillsetAction } = require('./action.exec.skillset')

      executeSkillsetAction.mockResolvedValue({ result: 'skillset result' })

      const result = await executeAction(
        ActionName.skillset,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeSkillsetAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'skillset result' })
    })

    it('should route memory action correctly', async () => {
      const { executeMemoryAction } = require('./action.exec.memory')

      executeMemoryAction.mockResolvedValue({ result: 'memory result' })

      const result = await executeAction(
        ActionName.memory,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeMemoryAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'memory result' })
    })

    it('should route space action correctly', async () => {
      const { executeSpaceAction } = require('./action.exec.space')

      executeSpaceAction.mockResolvedValue({ result: 'space result' })

      const result = await executeAction(
        ActionName.space,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeSpaceAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'space result' })
    })

    it('should route file action correctly', async () => {
      const { executeFileAction } = require('./action.exec.file')

      executeFileAction.mockResolvedValue({ result: 'file result' })

      const result = await executeAction(
        ActionName.file,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeFileAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'file result' })
    })

    it('should route attachment action correctly', async () => {
      const { executeAttachmentAction } = require('./action.exec.attachment')

      executeAttachmentAction.mockResolvedValue({ result: 'attachment result' })

      const result = await executeAction(
        ActionName.attachment,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeAttachmentAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'attachment result' })
    })

    it('should route fetch action correctly', async () => {
      const { executeFetchAction } = require('./action.exec.fetch')

      executeFetchAction.mockResolvedValue({ result: 'fetch result' })

      const result = await executeAction(
        ActionName.fetch,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeFetchAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'fetch result' })
    })

    it('should route view action correctly', async () => {
      const { executeViewAction } = require('./action.exec.view')

      executeViewAction.mockResolvedValue({ result: 'view result' })

      const result = await executeAction(
        ActionName.view,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeViewAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'view result' })
    })

    it('should route listen action correctly', async () => {
      const { executeListenAction } = require('./action.exec.listen')

      executeListenAction.mockResolvedValue({ result: 'listen result' })

      const result = await executeAction(
        ActionName.listen,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeListenAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'listen result' })
    })

    it('should route text action correctly', async () => {
      const { executeTextAction } = require('./action.exec.text')

      executeTextAction.mockResolvedValue({ result: 'text result' })

      const result = await executeAction(
        ActionName.text,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeTextAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'text result' })
    })

    it('should route image action correctly', async () => {
      const { executeImageAction } = require('./action.exec.image')

      executeImageAction.mockResolvedValue({ result: 'image result' })

      const result = await executeAction(
        ActionName.image,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeImageAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'image result' })
    })

    it('should route email action correctly', async () => {
      const { executeEmailAction } = require('./action.exec.email')

      executeEmailAction.mockResolvedValue({ result: 'email result' })

      const result = await executeAction(
        ActionName.email,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeEmailAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'email result' })
    })

    it('should route form action correctly', async () => {
      const { executeFormAction } = require('./action.exec.form')

      executeFormAction.mockResolvedValue({ result: 'form result' })

      const result = await executeAction(
        ActionName.form,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeFormAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'form result' })
    })

    it('should route echo action correctly', async () => {
      const { executeEchoAction } = require('./action.exec.echo')

      executeEchoAction.mockResolvedValue({ result: 'echo result' })

      const result = await executeAction(
        ActionName.echo,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeEchoAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'echo result' })
    })

    it('should route abort action correctly', async () => {
      const { executeAbortAction } = require('./action.exec.abort')

      executeAbortAction.mockResolvedValue({ result: 'abort result' })

      const result = await executeAction(
        ActionName.abort,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeAbortAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'abort result' })
    })

    it('should route shell action correctly', async () => {
      const { executeShellAction } = require('./action.exec.shell')

      executeShellAction.mockResolvedValue({ result: 'shell result' })

      const result = await executeAction(
        ActionName.shell,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeShellAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'shell result' })
    })

    it('should route conversation action correctly', async () => {
      const {
        executeConversationAction,
      } = require('./action.exec.conversation')

      executeConversationAction.mockResolvedValue({
        result: 'conversation result',
      })

      const result = await executeAction(
        ActionName.conversation,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeConversationAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'conversation result' })
    })

    it('should route task action correctly', async () => {
      const { executeTaskAction } = require('./action.exec.task')

      executeTaskAction.mockResolvedValue({ result: 'task result' })

      const result = await executeAction(
        ActionName.task,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeTaskAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'task result' })
    })

    it('should route time action correctly', async () => {
      const { executeTimeAction } = require('./action.exec.time')

      executeTimeAction.mockResolvedValue({ result: 'time result' })

      const result = await executeAction(
        ActionName.time,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeTimeAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'time result' })
    })

    it('should route rating action correctly', async () => {
      const { executeRatingAction } = require('./action.exec.rating')

      executeRatingAction.mockResolvedValue({ result: 'rating result' })

      const result = await executeAction(
        ActionName.rating,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeRatingAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'rating result' })
    })

    it('should route pack action correctly', async () => {
      const { executePackAction } = require('./action.exec.pack')

      executePackAction.mockResolvedValue({ result: 'pack result' })

      const result = await executeAction(
        ActionName.pack,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executePackAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'pack result' })
    })

    it('should route agent action correctly', async () => {
      const { executeAgentAction } = require('./action.exec.agent')

      executeAgentAction.mockResolvedValue({ result: 'agent result' })

      const result = await executeAction(
        ActionName.agent,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeAgentAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'agent result' })
    })

    it('should route mcp action correctly', async () => {
      const { executeMcpAction } = require('./action.exec.mcp')

      executeMcpAction.mockResolvedValue({ result: 'mcp result' })

      const result = await executeAction(
        ActionName.mcp,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeMcpAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'mcp result' })
    })

    it('should route list action correctly', async () => {
      const { executeListAction } = require('./action.exec.list')

      executeListAction.mockResolvedValue({ result: 'list result' })

      const result = await executeAction(
        ActionName.list,
        defaultInput,
        defaultParams,
        defaultOptions
      )

      expect(executeListAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        defaultOptions
      )
      expect(result).toEqual({ result: 'list result' })
    })
  })

  describe('error handling', () => {
    it('should propagate errors from action handlers', async () => {
      const { executeSearchAction } = require('./action.exec.search')
      const testError = new Error('Test error')

      executeSearchAction.mockRejectedValue(testError)

      await expect(
        executeAction(
          ActionName.search,
          defaultInput,
          defaultParams,
          defaultOptions
        )
      ).rejects.toThrow('Test error')
    })
  })

  describe('parameter passing', () => {
    it('should pass empty params correctly', async () => {
      const { executeEchoAction } = require('./action.exec.echo')

      executeEchoAction.mockResolvedValue({ result: 'echo' })

      await executeAction(ActionName.echo, defaultInput, {}, defaultOptions)

      expect(executeEchoAction).toHaveBeenCalledWith(
        defaultInput,
        {},
        defaultOptions
      )
    })

    it('should pass complex params correctly', async () => {
      const { executeSearchAction } = require('./action.exec.search')

      executeSearchAction.mockResolvedValue({ result: 'search result' })

      const complexParams = {
        query: 'test',
        filters: { type: 'document' },
        options: { limit: 10 },
      }

      await executeAction(
        ActionName.search,
        defaultInput,
        complexParams,
        defaultOptions
      )

      expect(executeSearchAction).toHaveBeenCalledWith(
        defaultInput,
        complexParams,
        defaultOptions
      )
    })

    it('should pass options with linked resources', async () => {
      const { executeBotAction } = require('./action.exec.bot')

      executeBotAction.mockResolvedValue({ result: 'bot result' })

      const optionsWithResources = {
        userId: 'user123',
        linkedResources: {
          blueprintId: 'blueprint123',
          skillsetId: 'skillset456',
        },
      }

      await executeAction(
        ActionName.bot,
        defaultInput,
        defaultParams,
        optionsWithResources
      )

      expect(executeBotAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        optionsWithResources
      )
    })

    it('should pass options with sink', async () => {
      const { executeFileAction } = require('./action.exec.file')

      executeFileAction.mockResolvedValue({ result: 'file result' })

      const mockSink = {
        push: jest.fn(),
      }

      const optionsWithSink = {
        userId: 'user123',
        sink: mockSink,
      }

      await executeAction(
        ActionName.file,
        defaultInput,
        defaultParams,
        optionsWithSink
      )

      expect(executeFileAction).toHaveBeenCalledWith(
        defaultInput,
        defaultParams,
        optionsWithSink
      )
    })
  })
})
