/* eslint-disable @typescript-eslint/no-explicit-any */
import { encode as encodeB64 } from '@/lib/b64'
import debug from '@/lib/debug'
import fetch from '@/lib/fetch'
import { normalizeTwilioMessageAddress } from '@/lib/twilio.phone'

type TwilioMessage =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string }

type ErrorWithData = Error & {
  data?: Record<string, any>
}

async function parseTwilioErrorResponse(
  response: Response | { text?: () => Promise<string>; status?: number }
): Promise<any> {
  if (typeof response.text !== 'function') {
    return null
  }

  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return {
      message: text,
    }
  }
}

export async function sendTwilioMessage({
  accountSid,
  authToken,
  from,
  to,
  message,
}: {
  accountSid?: string | null
  authToken?: string | null
  from?: string
  to?: string
  message: TwilioMessage
}): Promise<void> {
  if (!accountSid || !authToken || !from || !to) {
    debug(`skipping Twilio API fallback - missing delivery configuration`, {
      accountSid: Boolean(accountSid),
      authToken: Boolean(authToken),
      from: Boolean(from),
      to: Boolean(to),
    })

    return
  }

  const normalizedFrom = normalizeTwilioMessageAddress(from, {
    allowAlphanumericSender: true,
  })

  const normalizedTo = normalizeTwilioMessageAddress(to)

  if (!normalizedFrom || !normalizedTo) {
    const error = new Error(`Invalid Twilio message address`) as ErrorWithData

    error.data = {
      code: 'INVALID_TWILIO_ADDRESS',
      from,
      to,
      normalizedFrom,
      normalizedTo,
      messageType: message.type,
    }

    throw error
  }

  const body = new URLSearchParams({
    From: normalizedFrom,
    To: normalizedTo,
  })

  if (message.type === 'text') {
    body.set('Body', message.text)
  } else if (message.type === 'image') {
    body.set('MediaUrl', message.image)
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodeB64(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    }
  )

  if (!response.ok) {
    const data = await parseTwilioErrorResponse(response)
    const error = new Error(
      [
        `Twilio API failed: ${response.status}`,
        data?.code ? `code ${data.code}` : null,
        data?.message,
      ]
        .filter(Boolean)
        .join(' - ')
    ) as ErrorWithData

    error.data = {
      status: response.status,
      code: data?.code,
      message: data?.message,
      moreInfo: data?.more_info || data?.moreInfo,
      from: normalizedFrom,
      to: normalizedTo,
      messageType: message.type,
    }

    throw error
  }
}

export async function sendTwilioCall({
  accountSid,
  authToken,
  from,
  to,
  twiml,
}: {
  accountSid?: string | null
  authToken?: string | null
  from?: string
  to?: string
  twiml: string
}): Promise<void> {
  if (!accountSid || !authToken || !from || !to) {
    debug(`skipping Twilio call - missing delivery configuration`, {
      accountSid: Boolean(accountSid),
      authToken: Boolean(authToken),
      from: Boolean(from),
      to: Boolean(to),
    })

    return
  }

  const normalizedFrom = normalizeTwilioMessageAddress(from)
  const normalizedTo = normalizeTwilioMessageAddress(to)

  if (!normalizedFrom || !normalizedTo) {
    const error = new Error(`Invalid Twilio call address`) as ErrorWithData

    error.data = {
      code: 'INVALID_TWILIO_CALL_ADDRESS',
      from,
      to,
      normalizedFrom,
      normalizedTo,
    }

    throw error
  }

  const body = new URLSearchParams({
    From: normalizedFrom,
    To: normalizedTo,
    Twiml: twiml,
  })

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodeB64(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    }
  )

  if (!response.ok) {
    const data = await parseTwilioErrorResponse(response)
    const error = new Error(
      [
        `Twilio Call API failed: ${response.status}`,
        data?.code ? `code ${data.code}` : null,
        data?.message,
      ]
        .filter(Boolean)
        .join(' - ')
    ) as ErrorWithData

    error.data = {
      status: response.status,
      code: data?.code,
      message: data?.message,
      moreInfo: data?.more_info || data?.moreInfo,
      from: normalizedFrom,
      to: normalizedTo,
    }

    throw error
  }
}

export async function listTwilioIncomingPhoneNumbers({
  accountSid,
  authToken,
}: {
  accountSid?: string | null
  authToken?: string | null
}): Promise<string[]> {
  if (!accountSid || !authToken) {
    debug(`skipping Twilio phone number lookup - missing configuration`, {
      accountSid: Boolean(accountSid),
      authToken: Boolean(authToken),
    })

    return []
  }

  const url = new URL(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`
  )

  url.searchParams.set('PageSize', '1000')

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Basic ${encodeB64(`${accountSid}:${authToken}`)}`,
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const data = await parseTwilioErrorResponse(response)
    const error = new Error(
      [
        `Twilio Incoming Phone Numbers API failed: ${response.status}`,
        data?.code ? `code ${data.code}` : null,
        data?.message,
      ]
        .filter(Boolean)
        .join(' - ')
    ) as ErrorWithData

    error.data = {
      status: response.status,
      code: data?.code,
      message: data?.message,
      moreInfo: data?.more_info || data?.moreInfo,
    }

    throw error
  }

  const data = await response.json()

  if (!Array.isArray(data?.incoming_phone_numbers)) {
    return []
  }

  return data.incoming_phone_numbers
    .map((entry: any) => entry?.phone_number)
    .filter((value: any): value is string => typeof value === 'string')
}

export async function updateTwilioCall({
  accountSid,
  authToken,
  callSid,
  url,
  method = 'POST',
  status,
}: {
  accountSid?: string | null
  authToken?: string | null
  callSid?: string
  url?: string
  method?: 'GET' | 'POST'
  status?: 'completed' | 'canceled'
}): Promise<void> {
  if (!accountSid || !authToken || !callSid) {
    debug(`skipping Twilio call update - missing configuration`, {
      accountSid: Boolean(accountSid),
      authToken: Boolean(authToken),
      callSid: Boolean(callSid),
    })

    return
  }

  const body = new URLSearchParams()

  if (url) {
    body.set('Url', url)
    body.set('Method', method)
  }

  if (status) {
    body.set('Status', status)
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encodeB64(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(10_000),
    }
  )

  if (!response.ok) {
    const data = await parseTwilioErrorResponse(response)
    const error = new Error(
      [
        `Twilio Call Update API failed: ${response.status}`,
        data?.code ? `code ${data.code}` : null,
        data?.message,
      ]
        .filter(Boolean)
        .join(' - ')
    ) as ErrorWithData

    error.data = {
      status: response.status,
      code: data?.code,
      message: data?.message,
      moreInfo: data?.more_info || data?.moreInfo,
      callSid,
      url,
      method,
      callStatus: status,
    }

    throw error
  }
}
