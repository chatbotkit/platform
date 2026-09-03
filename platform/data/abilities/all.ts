import '@/lib/scope.server'

import ably from '@/data/abilities/catalogue/ably'
import abstractapiAPI from '@/data/abilities/catalogue/abstractapi.api'
import abstractapiEmail from '@/data/abilities/catalogue/abstractapi.email'
import abstractapiHolidays from '@/data/abilities/catalogue/abstractapi.holidays'
import abstractapiIp from '@/data/abilities/catalogue/abstractapi.ip'
import abstractapiPhone from '@/data/abilities/catalogue/abstractapi.phone'
import abstractapiVat from '@/data/abilities/catalogue/abstractapi.vat'
import accuweather from '@/data/abilities/catalogue/accuweather'
import activecampaign from '@/data/abilities/catalogue/activecampaign'
import ahrefs from '@/data/abilities/catalogue/ahrefs'
import airtable from '@/data/abilities/catalogue/airtable'
import alpaca from '@/data/abilities/catalogue/alpaca'
import alphavantage from '@/data/abilities/catalogue/alphavantage'
import amplitude from '@/data/abilities/catalogue/amplitude'
import antropic from '@/data/abilities/catalogue/anthropic.yaml'
import apollo from '@/data/abilities/catalogue/apollo'
import asana from '@/data/abilities/catalogue/asana'
import atlassian from '@/data/abilities/catalogue/atlassian'
import attio from '@/data/abilities/catalogue/attio'
import bamboohr from '@/data/abilities/catalogue/bamboohr'
import barcodelookup from '@/data/abilities/catalogue/barcodelookup'
import basecamp from '@/data/abilities/catalogue/basecamp'
import beehiiv from '@/data/abilities/catalogue/beehiiv'
import betterstackClickhouse from '@/data/abilities/catalogue/betterstack.clickhouse'
import bigcommerce from '@/data/abilities/catalogue/bigcommerce'
import brandfetch from '@/data/abilities/catalogue/brandfetch'
import brave from '@/data/abilities/catalogue/brave'
import buffer from '@/data/abilities/catalogue/buffer'
import cal from '@/data/abilities/catalogue/cal'
import calendly from '@/data/abilities/catalogue/calendly'
import cbkAbort from '@/data/abilities/catalogue/cbk.abort'
import cbkAgent from '@/data/abilities/catalogue/cbk.agent'
import cbkAnam from '@/data/abilities/catalogue/cbk.anam'
import cbkAttachment from '@/data/abilities/catalogue/cbk.attachment.yaml'
import cbkAvatarIntegration from '@/data/abilities/catalogue/cbk.avatar'
import cbkBlueprint from '@/data/abilities/catalogue/cbk.blueprint'
import cbkBot from '@/data/abilities/catalogue/cbk.bot'
import cbkConversation from '@/data/abilities/catalogue/cbk.conversation'
import cbkDatasetNew from '@/data/abilities/catalogue/cbk.dataset'
import cbkDatasetOld from '@/data/abilities/catalogue/cbk.dataset.yaml'
import cbkDiscord from '@/data/abilities/catalogue/cbk.discord'
import cbkEmailTs from '@/data/abilities/catalogue/cbk.email'
import cbkEmailYaml from '@/data/abilities/catalogue/cbk.email.yaml'
import cbkFetch from '@/data/abilities/catalogue/cbk.fetch'
import cbkFile from '@/data/abilities/catalogue/cbk.file'
import cbkGit from '@/data/abilities/catalogue/cbk.git'
import cbkGithub from '@/data/abilities/catalogue/cbk.github'
import cbkGooglechat from '@/data/abilities/catalogue/cbk.googlechat'
import cbkGraphql from '@/data/abilities/catalogue/cbk.graphql'
import cbkImage from '@/data/abilities/catalogue/cbk.image'
import cbkInstagram from '@/data/abilities/catalogue/cbk.instagram'
import cbkList from '@/data/abilities/catalogue/cbk.list'
import cbkListen from '@/data/abilities/catalogue/cbk.listen.yaml'
import cbkMath from '@/data/abilities/catalogue/cbk.math.yaml'
import cbkMcp from '@/data/abilities/catalogue/cbk.mcp'
import cbkMemory from '@/data/abilities/catalogue/cbk.memory'
import cbkMessenger from '@/data/abilities/catalogue/cbk.messenger'
import cbkMicrosoftteams from '@/data/abilities/catalogue/cbk.microsoftteams'
import cbkMock from '@/data/abilities/catalogue/cbk.mock.yaml'
import cbkRating from '@/data/abilities/catalogue/cbk.rating'
import cbkRecall from '@/data/abilities/catalogue/cbk.recall'
import cbkResearch from '@/data/abilities/catalogue/cbk.research'
import cbkSearch from '@/data/abilities/catalogue/cbk.search.yaml'
import cbkShell from '@/data/abilities/catalogue/cbk.shell'
import cbkSkills from '@/data/abilities/catalogue/cbk.skills'
import cbkSkillset from '@/data/abilities/catalogue/cbk.skillset'
import cbkSlack from '@/data/abilities/catalogue/cbk.slack'
import cbkSpace from '@/data/abilities/catalogue/cbk.space'
import cbkTask from '@/data/abilities/catalogue/cbk.task'
import cbkTelegram from '@/data/abilities/catalogue/cbk.telegram'
import cbkText from '@/data/abilities/catalogue/cbk.text.yaml'
import cbkTime from '@/data/abilities/catalogue/cbk.time'
import cbkTodo from '@/data/abilities/catalogue/cbk.todo'
import cbkTwilio from '@/data/abilities/catalogue/cbk.twilio'
import cbkUrl from '@/data/abilities/catalogue/cbk.url'
import cbkView from '@/data/abilities/catalogue/cbk.view.yaml'
import cbkWhatsapp from '@/data/abilities/catalogue/cbk.whatsapp'
import chargebee from '@/data/abilities/catalogue/chargebee'
import clearbit from '@/data/abilities/catalogue/clearbit'
import clickhouse from '@/data/abilities/catalogue/clickhouse'
import clickup from '@/data/abilities/catalogue/clickup'
import clockify from '@/data/abilities/catalogue/clockify'
import cloudflareSandbox from '@/data/abilities/catalogue/cloudflare.sandbox'
import cloudinary from '@/data/abilities/catalogue/cloudinary'
import coda from '@/data/abilities/catalogue/coda'
import codeqr from '@/data/abilities/catalogue/codeqr'
import coinapi from '@/data/abilities/catalogue/coinapi'
import devto from '@/data/abilities/catalogue/devto'
import dictionaryapi from '@/data/abilities/catalogue/dictionaryapi'
import diffbot from '@/data/abilities/catalogue/diffbot'
import discord from '@/data/abilities/catalogue/discord'
import docusignAPI from '@/data/abilities/catalogue/docusign.api'
import docusignEsignature from '@/data/abilities/catalogue/docusign.esignature'
import dropboxJs from '@/data/abilities/catalogue/dropbox'
import dropboxYaml from '@/data/abilities/catalogue/dropbox.yaml'
import easypost from '@/data/abilities/catalogue/easypost'
import elevenlabs from '@/data/abilities/catalogue/elevenlabs'
import facebookAds from '@/data/abilities/catalogue/facebook.ads'
import facebookPages from '@/data/abilities/catalogue/facebook.pages'
import figma from '@/data/abilities/catalogue/figma'
import financialmodelingprep from '@/data/abilities/catalogue/financialmodelingprep.yaml'
import firecrawl from '@/data/abilities/catalogue/firecrawl'
import freshdesk from '@/data/abilities/catalogue/freshdesk.yaml'
import geocodio from '@/data/abilities/catalogue/geocodio'
import giphy from '@/data/abilities/catalogue/giphy'
import githubTs from '@/data/abilities/catalogue/github'
import githubYaml from '@/data/abilities/catalogue/github.yaml'
import glimpse from '@/data/abilities/catalogue/glimpse'
import godaddy from '@/data/abilities/catalogue/godaddy'
import gohighlevel from '@/data/abilities/catalogue/gohighlevel'
import googleAds from '@/data/abilities/catalogue/google.ads'
import googleCalendar from '@/data/abilities/catalogue/google.calendar'
import googleDocs from '@/data/abilities/catalogue/google.docs'
import googleDrive from '@/data/abilities/catalogue/google.drive'
import googleMail from '@/data/abilities/catalogue/google.mail'
import googleMeet from '@/data/abilities/catalogue/google.meet'
import googleSearchconsole from '@/data/abilities/catalogue/google.searchconsole'
import googleSheets from '@/data/abilities/catalogue/google.sheets'
import googleTasks from '@/data/abilities/catalogue/google.tasks'
import gumroad from '@/data/abilities/catalogue/gumroad'
import harvest from '@/data/abilities/catalogue/harvest'
import hubspotTs from '@/data/abilities/catalogue/hubspot'
import hunter from '@/data/abilities/catalogue/hunter'
import hyperproof from '@/data/abilities/catalogue/hyperproof.yaml'
import instantly from '@/data/abilities/catalogue/instantly.yaml'
import intercom from '@/data/abilities/catalogue/intercom'
import lemonsqueezy from '@/data/abilities/catalogue/lemonsqueezy'
import linear from '@/data/abilities/catalogue/linear'
import linkedin from '@/data/abilities/catalogue/linkedin'
import linkupso from '@/data/abilities/catalogue/linkupso'
import listennotes from '@/data/abilities/catalogue/listennotes'
import magento from '@/data/abilities/catalogue/magento.yaml'
import mailchimp from '@/data/abilities/catalogue/mailchimp.yaml'
import mailgunAPI from '@/data/abilities/catalogue/mailgun.api'
import mailgunSend from '@/data/abilities/catalogue/mailgun.send'
import mailgunValidate from '@/data/abilities/catalogue/mailgun.validate'
import make from '@/data/abilities/catalogue/make.yaml'
import manychat from '@/data/abilities/catalogue/manychat'
import mapbox from '@/data/abilities/catalogue/mapbox'
import matillion from '@/data/abilities/catalogue/matillion'
import mcp from '@/data/abilities/catalogue/mcp.yaml'
import microsoftGraphAPI from '@/data/abilities/catalogue/microsoft.graph.api'
import microsoftGraphCalendar from '@/data/abilities/catalogue/microsoft.graph.calendar'
import microsoftGraphContact from '@/data/abilities/catalogue/microsoft.graph.contact'
import microsoftGraphFile from '@/data/abilities/catalogue/microsoft.graph.file'
import microsoftGraphMessage from '@/data/abilities/catalogue/microsoft.graph.message'
import microsoftGraphTeam from '@/data/abilities/catalogue/microsoft.graph.team'
import microsoftGraphUser from '@/data/abilities/catalogue/microsoft.graph.user'
import miro from '@/data/abilities/catalogue/miro'
import mixpanel from '@/data/abilities/catalogue/mixpanel.yaml'
import modelcontextprotocol from '@/data/abilities/catalogue/modelcontextprotocol'
import moltbook from '@/data/abilities/catalogue/moltbook'
import monday from '@/data/abilities/catalogue/monday'
import newsapi from '@/data/abilities/catalogue/newsapi'
import notion from '@/data/abilities/catalogue/notion.yaml'
import nubela from '@/data/abilities/catalogue/nubela.yaml'
import okta from '@/data/abilities/catalogue/okta'
import openaiAds from '@/data/abilities/catalogue/openai.ads'
import openstreetmap from '@/data/abilities/catalogue/openstreetmap.yaml'
import openweathermap from '@/data/abilities/catalogue/openweathermap'
import pagerduty from '@/data/abilities/catalogue/pagerduty'
import paypal from '@/data/abilities/catalogue/paypal.yaml'
import peopledatalabs from '@/data/abilities/catalogue/peopledatalabs.yaml'
import perplexity from '@/data/abilities/catalogue/perplexity.yaml'
import pexels from '@/data/abilities/catalogue/pexels'
import pipedream from '@/data/abilities/catalogue/pipedream.yaml'
import pipedrive from '@/data/abilities/catalogue/pipedrive'
import planetscale from '@/data/abilities/catalogue/planetscale'
import polymarket from '@/data/abilities/catalogue/polymarket'
import postgrest from '@/data/abilities/catalogue/postgrest'
import productboard from '@/data/abilities/catalogue/productboard'
import raindrop from '@/data/abilities/catalogue/raindrop'
import reddit from '@/data/abilities/catalogue/reddit'
import replicate from '@/data/abilities/catalogue/replicate'
import resend from '@/data/abilities/catalogue/resend'
import revenuecat from '@/data/abilities/catalogue/revenuecat'
import sendgrid from '@/data/abilities/catalogue/sendgrid'
import sentry from '@/data/abilities/catalogue/sentry'
import serpapi from '@/data/abilities/catalogue/serpapi'
import serper from '@/data/abilities/catalogue/serper'
import shopify from '@/data/abilities/catalogue/shopify.yaml'
import slack from '@/data/abilities/catalogue/slack'
import slackYaml from '@/data/abilities/catalogue/slack.yaml'
import snowflake from '@/data/abilities/catalogue/snowflake'
import sprites from '@/data/abilities/catalogue/sprites'
import stripe from '@/data/abilities/catalogue/stripe'
import supabase from '@/data/abilities/catalogue/supabase.yaml'
import tally from '@/data/abilities/catalogue/tally'
import tavily from '@/data/abilities/catalogue/tavily.yaml'
import taxjar from '@/data/abilities/catalogue/taxjar'
import telegram from '@/data/abilities/catalogue/telegram'
import todoist from '@/data/abilities/catalogue/todoist'
import trello from '@/data/abilities/catalogue/trello'
import twilioApi from '@/data/abilities/catalogue/twilio.api'
import twilioLookup from '@/data/abilities/catalogue/twilio.lookup'
import twilioVerify from '@/data/abilities/catalogue/twilio.verify'
import twitter from '@/data/abilities/catalogue/twitter'
import typeform from '@/data/abilities/catalogue/typeform'
import unsplash from '@/data/abilities/catalogue/unsplash'
import uplead from '@/data/abilities/catalogue/uplead'
import usefind from '@/data/abilities/catalogue/usefind.yaml'
import vanta from '@/data/abilities/catalogue/vanta.yaml'
import vapi from '@/data/abilities/catalogue/vapi'
import vonage from '@/data/abilities/catalogue/vonage.yaml'
import weatherbit from '@/data/abilities/catalogue/weatherbit'
import wikipedia from '@/data/abilities/catalogue/wikipedia'
import woocommerce from '@/data/abilities/catalogue/woocommerce.yaml'
import xeroAccounting from '@/data/abilities/catalogue/xero.accounting'
import xeroAPI from '@/data/abilities/catalogue/xero.api'
import zapier from '@/data/abilities/catalogue/zapier.yaml'
import zendesk from '@/data/abilities/catalogue/zendesk'
import zoom from '@/data/abilities/catalogue/zoom.yaml'

export type AbilityTemplate = (typeof cbkGraphql)[keyof typeof cbkGraphql]

const all: Record<string, AbilityTemplate> = {
  ...cbkFetch,
  ...cbkGraphql,
  ...cbkView,
  ...cbkListen,
  ...cbkList,
  ...cbkAgent,
  ...cbkAnam,
  ...cbkAvatarIntegration,
  ...cbkAgent,
  ...cbkAttachment,
  ...cbkBot,
  ...cbkEmailYaml,
  ...cbkEmailTs,
  ...cbkImage,
  ...cbkMath,
  ...cbkMock,
  ...cbkResearch,
  ...cbkSearch,
  ...cbkShell,
  ...cbkText,
  ...cbkFile,
  ...cbkAttachment,
  ...cbkDatasetOld,
  ...cbkAbort,
  ...cbkDatasetNew,
  ...cbkMcp,
  ...cbkSkillset,
  ...cbkUrl,
  ...cbkGit,
  ...cbkGithub,
  ...cbkSlack,
  ...cbkDiscord,
  ...cbkGooglechat,
  ...cbkInstagram,
  ...cbkMessenger,
  ...cbkMicrosoftteams,
  ...cbkTelegram,
  ...cbkWhatsapp,
  ...cbkTwilio,
  ...cbkRecall,
  ...mcp,
  ...notion,
  ...atlassian,
  ...githubYaml,
  ...githubTs,
  ...miro,
  ...zendesk,
  ...googleAds,
  ...googleCalendar,
  ...googleDocs,
  ...googleDrive,
  ...googleMail,
  ...googleMeet,
  ...googleSearchconsole,
  ...googleSheets,
  ...googleTasks,
  ...hubspotTs,
  ...hunter,
  ...hyperproof,
  ...serpapi,
  ...instantly,
  ...serper,
  ...zapier,
  ...slack,
  ...slackYaml,
  ...discord,
  ...docusignAPI,
  ...docusignEsignature,
  ...shopify,
  ...perplexity,
  ...reddit,
  ...replicate,
  ...revenuecat,
  ...resend,
  ...postgrest,
  ...supabase,
  ...zoom,
  ...peopledatalabs,
  ...stripe,
  ...magento,
  ...mailchimp,
  ...dropboxJs,
  ...dropboxYaml,
  ...calendly,
  ...chargebee,
  ...cal,
  ...woocommerce,
  ...bigcommerce,
  ...beehiiv,
  ...betterstackClickhouse,
  ...brandfetch,
  ...buffer,
  ...freshdesk,
  ...financialmodelingprep,
  ...apollo,
  ...openstreetmap,
  ...openweathermap,
  ...paypal,
  ...facebookPages,
  ...facebookAds,
  ...figma,
  ...firecrawl,
  ...usefind,
  ...vanta,
  ...mixpanel,
  ...mapbox,
  ...gohighlevel,
  ...tavily,
  ...make,
  ...vonage,
  ...vapi,
  ...lemonsqueezy,
  ...linear,
  ...linkedin,
  ...linkupso,
  ...mailgunAPI,
  ...mailgunSend,
  ...mailgunValidate,
  ...microsoftGraphAPI,
  ...microsoftGraphCalendar,
  ...microsoftGraphContact,
  ...microsoftGraphMessage,
  ...microsoftGraphFile,
  ...microsoftGraphTeam,
  ...microsoftGraphUser,
  ...monday,
  ...wikipedia,
  ...twilioApi,
  ...twilioLookup,
  ...twilioVerify,
  ...nubela,
  ...okta,
  ...openaiAds,
  ...brave,
  ...sendgrid,
  ...elevenlabs,
  ...easypost,
  ...cbkSkills,
  ...cbkBlueprint,
  ...cbkConversation,
  ...cbkSpace,
  ...cbkTask,
  ...cbkTime,
  ...cbkRating,
  ...cbkMemory,
  ...cbkTodo,
  ...godaddy,
  ...gumroad,
  ...harvest,
  ...trello,
  ...typeform,
  ...accuweather,
  ...activecampaign,
  ...ahrefs,
  ...tally,
  ...taxjar,
  ...telegram,
  ...todoist,
  ...coinapi,
  ...clearbit,
  ...clickhouse,
  ...clickup,
  ...clockify,
  ...cloudflareSandbox,
  ...cloudinary,
  ...coda,
  ...codeqr,
  ...dictionaryapi,
  ...ably,
  ...airtable,
  ...alpaca,
  ...asana,
  ...alphavantage,
  ...newsapi,
  ...pipedream,
  ...raindrop,
  ...intercom,
  ...sentry,
  ...snowflake,
  ...sprites,
  ...unsplash,
  ...uplead,
  ...amplitude,
  ...antropic,
  ...giphy,
  ...glimpse,
  ...listennotes,
  ...pexels,
  ...polymarket,
  ...pipedrive,
  ...pagerduty,
  ...productboard,
  ...barcodelookup,
  ...bamboohr,
  ...basecamp,
  ...devto,
  ...diffbot,
  ...weatherbit,
  ...geocodio,
  ...clockify,
  ...abstractapiAPI,
  ...abstractapiEmail,
  ...abstractapiHolidays,
  ...abstractapiIp,
  ...abstractapiPhone,
  ...abstractapiVat,
  ...attio,
  ...manychat,
  ...matillion,
  ...planetscale,
  ...modelcontextprotocol,
  ...xeroAPI,
  ...xeroAccounting,
  ...twitter,
  ...moltbook,
}

export default all
