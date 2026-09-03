import { WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS } from '@/config/widget'

import { WidgetIntegrationModel } from '@/prisma/zod'

import { z } from 'zod'

const WritableWidgetIntegrationModel = WidgetIntegrationModel.extend({
  sessionDuration: z
    .number()
    .min(0)
    .max(WIDGET_SESSION_DURATION_MAX_IN_MILLISECONDS)
    .nullable(),
})

export const WidgetIntegrationCreate = WritableWidgetIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const WidgetIntegrationUpdate = WritableWidgetIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const WidgetIntegrationUpsert = WritableWidgetIntegrationModel.omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  // specific
}).partial()

export const WidgetIntegrationList = WidgetIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

export const WidgetIntegrationFetch = WidgetIntegrationModel.omit({
  userId: true,
  // specific
}).partial()

// Widget resource import/export intentionally round-trips embeddable UI config.
export const cloneableBlueprintSchema = WidgetIntegrationUpsert.omit({
  blueprintId: true,
})

export const blueprintSchema = WidgetIntegrationUpsert.omit({
  blueprintId: true,
  // specific
  theme: true,
  layout: true,
  title: true,
  intro: true,
  initial: true,
  placeholder: true,
  origin: true,
  language: true,
  plugins: true,
  stream: true,
  verbose: true,
  tools: true,
  unfurl: true,
  math: true,
  carousel: true,
  form: true,
  attachments: true,
  autoScroll: true,
  startFirst: true,
  contactCollection: true,
  exportConversation: true,
  restartConversation: true,
  maximize: true,
  messagePeek: true,
  voiceIn: true,
  voiceOut: true,
  poweredBy: true,
})
