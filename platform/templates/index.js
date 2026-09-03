// @ts-check
import agent from './agent'
import { googlechat, slack, telegram, whatsapp } from './channels'
import example from './example'
import hub from './hub'
import messaging from './messaging'
import onboarding from './onboarding'
import widget from './widget'

/**
 * @typedef {{
 *   templateId: string,
 *   icon: string,
 *   Icon?: any,
 *   templateName: string,
 *   templateDescription: string,
 *   forwardButtonCaption?: string,
 *   forwardButtonLastCaption?: string,
 *   steps: string[],
 *   options: Record<string,any>,
 *   values: Record<string,any>,
 *   init?: (context: {
 *     options: Record<string,any>,
 *     setOptions: (options: Record<string,any>) => void,
 *     values: Record<string,any>,
 *     setValues: (values: Record<string,any>) => void,
 *     query: Record<string,string>
 *   }) => Promise<void|{redirect?: string, nextStep?: string}>,
 *   task: (context: {
 *     options: Record<string,any>,
 *     setOptions: (options: Record<string,any>) => void,
 *     values: Record<string,any>,
 *     setValues: (values: Record<string,any>) => void,
 *     fetch: (url: string, options: any) => any
 *   }) => Promise<{successMessage?: string, successButtonAction?: string|(() => void), successButtonCaption?: string, createdBlueprintId?: string, createdBlueprintName?: string}|void>,
 *   closable?: boolean,
 *   hidden?: boolean
 * }} Template
 *
 * @type {Template[]}
 */
export const templates = [
  // visible - start from a ready-made solution, then use-case oriented starters

  example, // Ready-Made Solution (browse, search and clone the examples catalogue)

  widget, // Website Agent

  slack,

  telegram,

  whatsapp,

  googlechat,

  // hidden

  agent,

  messaging,

  hub,

  onboarding,
]

export default templates
