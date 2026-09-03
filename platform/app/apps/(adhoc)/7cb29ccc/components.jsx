'use client'

import { useCallback } from 'react'

import { shortFormat } from '@/lib/number'

import { useInfobarToggle } from '@/layouts/App'

import DynamicIcon from '@/components/DynamicIcon'
import List from '@/components/List'
import ObjectView from '@/components/ObjectView'

import usePopup from '@/hooks/usePopup'

import { LineChart } from '@tremor/react'

import clsx from 'clsx'
import pluralize from 'pluralize'

export function DailyChart({ title, data }) {
  data = data.map(({ date, total }) => {
    return {
      date: new Date(date).getDate(),
      total: total,
    }
  })

  return data.length ? (
    <div className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <LineChart
        className="h-80 text-xs"
        data={data}
        index="date"
        categories={['total']}
        colors={['indigo']}
        valueFormatter={(number) =>
          `${Intl.NumberFormat('us').format(number).toString()}`
        }
        yAxisWidth={60}
      />
    </div>
  ) : null
}

export function Details({ details }) {
  const { popup, openPopup } = usePopup()

  return (
    <>
      {popup}
      <div className="px-4 space-y-4">
        {details.metric ? (
          <Card
            title={details.metric.title}
            description={details.metric.description}
            value={details.metric.value}
            change={details.metric.change}
            dimension={details.metric.dimension}
            period={details.metric.period}
          />
        ) : null}
        {details.chart ? (
          <>
            {details.chart.type === 'line' ? (
              <DailyChart title="Breakdown" data={details.chart.data} />
            ) : null}
          </>
        ) : null}
        {details.list ? (
          <List>
            {details.list.map((item, index) => (
              <List.Item
                key={index}
                title={item.name}
                body={item.description}
                timestamp={item.createdAt}
                icon={
                  item.icon ? (
                    <DynamicIcon
                      className="w-10 h-10 rounded-full"
                      icon={item.icon}
                    />
                  ) : undefined
                }
                onClick={() => {
                  openPopup(<ObjectView className="text-xs" object={item} />, {
                    title: item.name,
                    description: item.description,
                    cancelButtonCaption: 'Close',
                  })
                }}
              >
                {item.tags?.map((tag, index) =>
                  typeof tag === 'string' ? (
                    <span className="tag" key={index}>
                      {tag}
                    </span>
                  ) : (
                    <span className="tag" key={index}>
                      {tag.value} {pluralize(tag.name, tag.value)}
                    </span>
                  )
                )}
              </List.Item>
            ))}
          </List>
        ) : null}
      </div>
    </>
  )
}

export function Card({
  title,
  description,

  value,
  change,
  dimension,

  period,

  details,

  className,

  ...props
}) {
  const { toggle, toRender } = useInfobarToggle({
    id: `references-block-${title}`,

    width: '30%',

    render: useCallback(() => {
      if (!details) {
        return null
      }

      return <Details details={details} />
    }, [details]),

    renderNav: useCallback(() => <h1>{title}</h1>, [title]),
  })

  const hasDetails = value > 0 && !!details

  return (
    <>
      <div
        {...props}
        className={clsx(
          'flex flex-col gap-2',
          'auto-text-gray-800',
          {
            'auto-bg-gray-50': !hasDetails,
            'auto-bg-gray-100': hasDetails,
          },
          'border auto-border-gray-200 rounded-xl',
          'p-5',
          {
            'cursor-pointer hover:auto-border-gray-300': hasDetails,
          },
          className
        )}
        onClick={hasDetails ? toggle : undefined}
      >
        <div className="text-md font-semibold">{title}</div>
        <div className="text-sm">{description}</div>
        <div className="flex-1" />
        <div className="text-4xl">
          <span>{shortFormat(value)}</span>
          {change ? (
            <sup className="ml-2">
              <span className="text-xs">
                {change > 0 ? '+' : ''}
                {shortFormat(change)}
              </span>
            </sup>
          ) : null}
        </div>
        {dimension && <div className="text-xs">{dimension}</div>}
        {period && <div className="text-xs">{period}</div>}
      </div>
      {toRender}
    </>
  )
}

export function Main({ overview, className, children, ...props }) {
  return (
    <div {...props} className={clsx('flex flex-col gap-5', className)}>
      <div className="grid grid-cols-3 gap-5">
        {overview.data.map(
          (
            { title, description, value, change, dimension, period, details },
            index
          ) => (
            <Card
              key={index}
              title={title}
              description={description}
              value={value}
              change={change}
              dimension={dimension}
              period={period}
              details={details}
            />
          )
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
