import { BiData, BiSupport } from 'react-icons/bi'
import {
  FaDiscord,
  FaEnvelope,
  FaFacebookMessenger,
  FaGithub,
  FaInstagram,
  FaMicrosoft,
  FaServer,
  FaSlack,
  FaTelegram,
  FaWhatsapp,
} from 'react-icons/fa'
import { GoZap } from 'react-icons/go'
import { MdLanguage } from 'react-icons/md'
import {
  SiGooglechat,
  SiNotion,
  SiTwilio,
  SiWordpress,
  SiZapier,
  SiZendesk,
} from 'react-icons/si'

import { isDevelopment, isStaging } from '@/lib/env'

import AvatarIcon from '@/icons/avatar.svg'
import AnamIcon from '@/icons/brands/anam.svg'
import McpIcon from '@/icons/brands/mcp.svg'
import RecallIcon from '@/icons/brands/recall.svg'
import WidgetIcon from '@/icons/widget.svg'

const _hiddenOutsideDevelopmentAndStaging = !isDevelopment && !isStaging

export const icons = {
  widget: ({ className }) => {
    return <WidgetIcon className={className} />
  },

  slack: ({ className }) => {
    return <FaSlack className={className} />
  },

  discord: ({ className }) => {
    return <FaDiscord className={className} />
  },

  microsoftteams: ({ className }) => {
    return <FaMicrosoft className={className} />
  },

  googlechat: ({ className }) => {
    return <SiGooglechat className={className} />
  },

  whatsapp: ({ className }) => {
    return <FaWhatsapp className={className} />
  },

  messenger: ({ className }) => {
    return <FaFacebookMessenger className={className} />
  },

  instagram: ({ className }) => {
    return <FaInstagram className={className} />
  },

  telegram: ({ className }) => {
    return <FaTelegram className={className} />
  },

  twilio: ({ className }) => {
    return <SiTwilio className={className} />
  },

  recall: ({ className }) => {
    return <RecallIcon className={className} />
  },

  anam: ({ className }) => {
    return <AnamIcon className={className} />
  },

  github: ({ className }) => {
    return <FaGithub className={className} />
  },

  email: ({ className }) => {
    return <FaEnvelope className={className} />
  },

  trigger: ({ className }) => {
    return <GoZap className={className} />
  },

  avatar: ({ className }) => {
    return <AvatarIcon className={className} />
  },

  sitemap: ({ className }) => {
    return <MdLanguage className={className} />
  },

  notion: ({ className }) => {
    return <SiNotion className={className} />
  },

  support: ({ className }) => {
    return <BiSupport className={className} />
  },

  extract: ({ className }) => {
    return <BiData className={className} />
  },

  wordpress: ({ className }) => {
    return <SiWordpress className={className} />
  },

  zapier: ({ className }) => {
    return <SiZapier className={className} />
  },

  zendesk: ({ className }) => {
    return <SiZendesk className={className} />
  },

  mcpserver: ({ className }) => {
    return <McpIcon className={className} />
  },

  skillserver: ({ className }) => {
    return <FaServer className={className} />
  },
}

// `resource` is the parent an integration of this type attaches to, mirroring
// the integration relations on the Bot, Dataset and Skillset prisma models. It
// drives which integrations are offered when a new one is created from the
// page of a given resource.

// @todo derive from prisma

export const actions = [
  {
    slug: 'widget',
    resource: 'bot',
    title: 'AI Widget',
    Icon: icons.widget,
  },
  {
    slug: 'slack',
    resource: 'bot',
    title: 'Slack Bot',
    Icon: icons.slack,
  },
  {
    slug: 'discord',
    resource: 'bot',
    title: 'Discord Bot',
    Icon: icons.discord,
  },
  {
    slug: 'microsoftteams',
    resource: 'bot',
    title: 'Microsoft Teams Bot',
    Icon: icons.microsoftteams,
  },
  {
    slug: 'googlechat',
    resource: 'bot',
    title: 'Google Chat Bot',
    Icon: icons.googlechat,
  },
  {
    slug: 'whatsapp',
    resource: 'bot',
    title: 'WhatsApp Bot',
    Icon: icons.whatsapp,
  },
  {
    slug: 'messenger',
    resource: 'bot',
    title: 'Messenger Bot',
    Icon: icons.messenger,
  },
  {
    slug: 'instagram',
    resource: 'bot',
    title: 'Instagram Bot',
    Icon: icons.instagram,
  },
  {
    slug: 'telegram',
    resource: 'bot',
    title: 'Telegram Bot',
    Icon: icons.telegram,
  },
  {
    slug: 'twilio',
    resource: 'bot',
    title: 'Twilio Bot',
    Icon: icons.twilio,
  },
  {
    slug: 'recall',
    resource: 'bot',
    title: 'Recall Meeting Bot',
    Icon: icons.recall,
  },
  {
    slug: 'anam',
    resource: 'bot',
    title: 'Anam Avatar Bot',
    Icon: icons.anam,
  },
  {
    slug: 'github',
    resource: 'bot',
    title: 'GitHub Bot',
    Icon: icons.github,
  },
  {
    slug: 'email',
    resource: 'bot',
    title: 'Email Bot',
    Icon: icons.email,
  },
  {
    slug: 'trigger',
    resource: 'bot',
    title: 'Trigger Bot',
    Icon: icons.trigger,
  },
  {
    slug: 'avatar',
    resource: 'bot',
    title: 'AI Avatar',
    Icon: icons.avatar,
  },
  {
    slug: 'sitemap',
    resource: 'dataset',
    title: 'Website Importer',
    Icon: icons.sitemap,
  },
  {
    slug: 'notion',
    resource: 'dataset',
    title: 'Notion Importer',
    Icon: icons.notion,
  },
  {
    slug: 'support',
    resource: 'bot',
    title: 'Customer Support',
    Icon: icons.support,
  },
  {
    slug: 'extract',
    resource: 'bot',
    title: 'Data Extraction',
    Icon: icons.extract,
  },
  {
    slug: 'mcpserver',
    resource: 'skillset',
    title: 'MCP Server',
    Icon: icons.mcpserver,
  },
  {
    slug: 'skillserver',
    resource: 'skillset',
    title: 'Skill Server',
    Icon: icons.skillserver,
  },
  // {
  //   slug: 'wordpress',

  //   title: 'Wordpress',
  //   Icon: icons.wordpress,
  //   link: '/wordpress',
  // },
  // {
  //   slug: 'zapier',
  //   title: 'Zapier',
  //   Icon: icons.zapier,
  //   link: '/zapier',
  // },
  // {
  //   slug: 'zendesk',
  //   title: 'Zendesk',
  //   Icon: icons.zendesk,
  //   link: '/zendesk',
  // },
]

export const items = actions.reduce((acc, action) => {
  acc[action.slug] = action

  return acc
}, {})
