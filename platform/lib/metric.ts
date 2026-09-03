import { QUARTER_HOUR_IN_SECONDS } from '@chatbotkit-dev/time'

import prisma from '@/prisma/client'
import { getEventMetricSeriesOverPeriod } from '@/prisma/sql'
import type { User } from '@/prisma/types'

import { ttlCache } from '@/lib/cache'
import { toNumber } from '@/lib/number'

export async function getEventMetricSeriesNow(
  user: Pick<User, 'id' | 'email'>,
  type: string
): Promise<{ date: Date | null; total: number }[]> {
  const interval = 90 // @todo get per-customer interval

  // @todo this might be slow - better indexing should be needed - check the
  // planetscale dashboard for any recommendations

  // @note the period boundary is computed here (rather than with a MySQL
  // CURDATE()/INTERVAL expression) and passed as a parameter - keeps the SQL
  // portable and lets TypedSQL type the query.

  const fromDate = new Date()

  fromDate.setHours(0, 0, 0, 0)
  fromDate.setDate(fromDate.getDate() - interval)

  const rows = await prisma.$queryRawTyped(
    getEventMetricSeriesOverPeriod(user.id, type, fromDate)
  )

  return rows.map(({ date, total }) => ({
    date: date == null ? null : new Date(date),
    total: toNumber(total),
  }))
}

export async function getEventMetricSeries(
  user: Pick<User, 'id' | 'email'>,
  type: string
): Promise<{ date: Date | null; total: number }[]> {
  return ttlCache(
    `event:metric:user[${user.id}].type[${type}]`,
    QUARTER_HOUR_IN_SECONDS,
    async () => {
      return getEventMetricSeriesNow(user, type)
    }
  )
}
