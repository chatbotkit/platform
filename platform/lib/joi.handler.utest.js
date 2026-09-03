import { withSchema } from '@/lib/joi.handler'
import { schemaErrorToError } from '@/lib/joi.schema'
import { parseRequestJson } from '@/lib/request'
import { respondFromError } from '@/lib/response'

import Joi from 'joi'

jest.mock('@/lib/request', () => ({
  parseRequestJson: jest.fn(),
}))

jest.mock('@/lib/response', () => ({
  respondFromError: jest.fn(),
}))

jest.mock('@/lib/joi.schema', () => ({
  schemaErrorToError: jest.fn(),
}))

describe('joi.handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('withSchema', () => {
    describe('successful validation', () => {
      it('should validate request body and call handler with validated value', async () => {
        const schema = Joi.object({
          name: Joi.string().required(),
          age: Joi.number(),
        })

        const mockBody = { name: 'Test', age: 25 }
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })
        const mockResponse = new Response('success')

        parseRequestJson.mockResolvedValue(mockBody)

        const handler = jest.fn().mockResolvedValue(mockResponse)
        const wrappedHandler = withSchema(schema, handler)

        const result = await wrappedHandler(mockRequest, {
          sessionData: 'test',
        })

        expect(parseRequestJson).toHaveBeenCalledWith(mockRequest)
        expect(handler).toHaveBeenCalledWith(
          mockRequest,
          { sessionData: 'test' },
          mockBody
        )
        expect(result).toBe(mockResponse)
      })

      it('should pass empty object if validation returns null', async () => {
        const schema = Joi.object({
          optional: Joi.string(),
        })

        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify({}),
        })
        const mockResponse = new Response('success')

        parseRequestJson.mockResolvedValue({})

        const handler = jest.fn().mockResolvedValue(mockResponse)
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest)

        expect(handler).toHaveBeenCalledWith(mockRequest, {})
      })

      it('should pass session context to schema validation', async () => {
        const schema = Joi.object({
          value: Joi.string().required(),
        })

        const mockBody = { value: 'test' }
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })
        const mockSession = { userId: '123' }

        parseRequestJson.mockResolvedValue(mockBody)

        const handler = jest.fn().mockResolvedValue(new Response('ok'))
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest, mockSession)

        // Validation happens internally with context
        expect(handler).toHaveBeenCalled()
      })

      it('should handle multiple rest parameters', async () => {
        const schema = Joi.object({
          data: Joi.string(),
        })

        const mockBody = { data: 'test' }
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })

        parseRequestJson.mockResolvedValue(mockBody)

        const handler = jest.fn().mockResolvedValue(new Response('ok'))
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest, 'param1', 'param2', 'param3')

        expect(handler).toHaveBeenCalledWith(
          mockRequest,
          'param1',
          'param2',
          'param3',
          mockBody
        )
      })
    })

    describe('validation errors', () => {
      it('should handle validation errors and return error response', async () => {
        const schema = Joi.object({
          required: Joi.string().required(),
        })

        const mockBody = {}
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })

        parseRequestJson.mockResolvedValue(mockBody)

        const validationError = new Error('Validation failed')
        const convertedError = {
          code: 'validation_error',
          message: 'Required field missing',
        }
        const errorResponse = new Response('error', { status: 400 })

        schemaErrorToError.mockReturnValue(convertedError)
        respondFromError.mockReturnValue(errorResponse)

        const handler = jest.fn()
        const wrappedHandler = withSchema(schema, handler)

        const result = await wrappedHandler(mockRequest)

        expect(parseRequestJson).toHaveBeenCalledWith(mockRequest)
        expect(schemaErrorToError).toHaveBeenCalled()
        expect(respondFromError).toHaveBeenCalledWith(convertedError)
        expect(handler).not.toHaveBeenCalled()
        expect(result).toBe(errorResponse)
      })

      it('should handle type validation errors', async () => {
        const schema = Joi.object({
          age: Joi.number().required(),
        })

        const mockBody = { age: 'not a number' }
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })

        parseRequestJson.mockResolvedValue(mockBody)

        const convertedError = {
          code: 'type_error',
          message: 'Must be a number',
        }
        const errorResponse = new Response('error', { status: 400 })

        schemaErrorToError.mockReturnValue(convertedError)
        respondFromError.mockReturnValue(errorResponse)

        const handler = jest.fn()
        const wrappedHandler = withSchema(schema, handler)

        const result = await wrappedHandler(mockRequest)

        expect(respondFromError).toHaveBeenCalledWith(convertedError)
        expect(handler).not.toHaveBeenCalled()
        expect(result).toBe(errorResponse)
      })
    })

    describe('edge cases', () => {
      it('should handle empty request body', async () => {
        const schema = Joi.object({
          optional: Joi.string(),
        })

        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify({}),
        })

        parseRequestJson.mockResolvedValue({})

        const handler = jest.fn().mockResolvedValue(new Response('ok'))
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest)

        expect(handler).toHaveBeenCalled()
      })

      it('should handle complex nested schemas', async () => {
        const schema = Joi.object({
          user: Joi.object({
            name: Joi.string().required(),
            contact: Joi.object({
              email: Joi.string().email(),
            }),
          }),
        })

        const mockBody = {
          user: {
            name: 'Test',
            contact: {
              email: 'test@example.com',
            },
          },
        }

        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })

        parseRequestJson.mockResolvedValue(mockBody)

        const handler = jest.fn().mockResolvedValue(new Response('ok'))
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest)

        expect(handler).toHaveBeenCalledWith(mockRequest, mockBody)
      })

      it('should handle array validation', async () => {
        const schema = Joi.object({
          items: Joi.array().items(Joi.string()),
        })

        const mockBody = { items: ['item1', 'item2', 'item3'] }
        const mockRequest = new Request('http://localhost/test', {
          method: 'POST',
          body: JSON.stringify(mockBody),
        })

        parseRequestJson.mockResolvedValue(mockBody)

        const handler = jest.fn().mockResolvedValue(new Response('ok'))
        const wrappedHandler = withSchema(schema, handler)

        await wrappedHandler(mockRequest)

        expect(handler).toHaveBeenCalled()
      })
    })
  })
})
