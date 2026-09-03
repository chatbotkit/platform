import { ONE_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import debug from '@chatbotkit-dev/debug'
import { getRandomId } from '@chatbotkit-dev/string'

import {
  AssumeRoleCommand,
  type AssumeRoleCommandOutput,
  STSClient,
} from '@aws-sdk/client-sts'

import { z } from 'zod'

const schema = z.object({
  SERVICE_AWS_REGION: z.string(),
  SERVICE_AWS_ACCESS_KEY_ID: z.string(),
  SERVICE_AWS_SECRET_ACCESS_KEY: z.string(),

  // @note the role the scoped session is assumed into. It was hardcoded in the
  // platform's source as a literal ARN carrying this deployment's AWS account
  // number, which is exactly the kind of thing that must not ship in open code.
  SERVICE_AWS_STORAGE_ROLE_ARN: z.string().optional(),
})

let cachedEnv: z.infer<typeof schema> | undefined

function getEnv(): z.infer<typeof schema> {
  if (!cachedEnv) {
    cachedEnv = schema.parse(process.env)
  }

  return cachedEnv
}

let cachedClient: STSClient | undefined

function getClient(): STSClient {
  if (!cachedClient) {
    const env = getEnv()

    cachedClient = new STSClient({
      region: env.SERVICE_AWS_REGION,
      credentials: {
        accessKeyId: env.SERVICE_AWS_ACCESS_KEY_ID,
        secretAccessKey: env.SERVICE_AWS_SECRET_ACCESS_KEY,
      },
    })
  }

  return cachedClient
}

/**
 * Get bucket access credentials based on the given bucket:prefix mapping
 */
export function getStorageRoleArn(): string | undefined {
  return getEnv().SERVICE_AWS_STORAGE_ROLE_ARN
}

export async function getBucketAccessCredentials(
  locations: Record<string, string>
): Promise<AssumeRoleCommandOutput> {
  const roleArn = getStorageRoleArn()

  if (!roleArn) {
    // @note deliberately not `null`. Null means "this backend cannot mint
    // scoped credentials at all" and the caller degrades. This backend can -
    // it is simply not configured to, and that is a deployment error worth
    // saying out loud rather than degrading past.
    throw new Error(
      'SERVICE_AWS_STORAGE_ROLE_ARN is not set, so scoped bucket credentials ' +
        'cannot be issued and sandboxes cannot mount storage. Set it to the ' +
        'ARN of the role that grants s3:GetObject/PutObject/DeleteObject on ' +
        'the storage buckets.'
    )
  }

  const input = {
    DurationSeconds: ONE_HOUR_IN_SECONDS,
    Policy: JSON.stringify({
      Version: '2012-10-17',
      Statement: Object.entries(locations)
        .map(([bucket, prefix]) => ({
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
          Resource: `arn:aws:s3:::${bucket}/${prefix.replace(
            /^\/+|\/+$/g,
            ''
          )}/*`,
        }))
        .concat(
          Object.entries(locations).map(([bucket, prefix]) => ({
            Effect: 'Allow',
            Action: ['s3:ListBucket'],
            Resource: `arn:aws:s3:::${bucket}`,
            Condition: {
              StringLike: {
                's3:prefix': [`${prefix.replace(/^\/+|\/+$/g, '')}/*`],
              },
            },
          }))
        ),
    }),

    RoleArn: roleArn,
    RoleSessionName: getRandomId('session-'),
  }

  debug(`input`, { input })

  return await getClient().send(new AssumeRoleCommand(input))
}
