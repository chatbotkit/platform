import { createFetchTemplate, field, secret } from '@/lib/ability.template'

const abilities = {
  'twilio/verification/send': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Send Verification Code',
    description:
      'Send a verification code via SMS or call to verify phone number ownership',
    tags: ['twilio', 'verification', 'otp', 'send'],
    secret: '@twilio',
    instruction: {
      method: 'POST',
      url: 'https://verify.twilio.com',
      path: [
        '/v2/Services/',
        field({
          name: 'serviceSid',
          description: 'Verify service SID',
          placeholder: true,
        }),
        '/Verifications',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        To: field({
          name: 'to',
          description: 'Phone number to send verification code in E.164 format',
          placeholder: true,
        }),
        Channel: field({
          name: 'channel',
          description: 'Verification channel',
          optional: true,
          enum: ['sms', 'call', 'email'],
          default: 'sms',
        }),
      },
    },
  }),

  'twilio/verification/check': createFetchTemplate({
    provider: 'twilio',
    icon: '@logo/twilio.com',
    name: 'Check Verification Code',
    description: 'Verify a code sent to a phone number or email',
    tags: ['twilio', 'verification', 'otp', 'check'],
    secret: '@twilio',
    instruction: {
      method: 'POST',
      url: 'https://verify.twilio.com',
      path: [
        '/v2/Services/',
        field({
          name: 'serviceSid',
          description: 'Verify service SID',
          placeholder: true,
        }),
        '/VerificationCheck',
      ],
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: {
        To: field({
          name: 'to',
          description:
            'Phone number or email that received the verification code',
          placeholder: true,
        }),
        Code: field({
          name: 'code',
          description: 'The verification code to check',
        }),
      },
    },
  }),
}

export default abilities
