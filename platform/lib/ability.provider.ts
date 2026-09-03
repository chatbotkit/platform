// @note providers whose slug does not title-case into their actual brand.
// Anything missing here falls back to a title-cased slug, so only the awkward
// spellings need an entry.

const PROVIDER_TITLES: Record<string, string> = {
  abstractapi: 'AbstractAPI',
  accuweather: 'AccuWeather',
  activecampaign: 'ActiveCampaign',
  alphavantage: 'Alpha Vantage',
  bamboohr: 'BambooHR',
  barcodelookup: 'Barcode Lookup',
  betterstack: 'BetterStack',
  bigcommerce: 'BigCommerce',
  cal: 'Cal.com',
  cbk: 'CBK',
  clickhouse: 'ClickHouse',
  clickup: 'ClickUp',
  codeqr: 'CodeQR',
  coinapi: 'CoinAPI',
  devto: 'DEV.to',
  dictionaryapi: 'DictionaryAPI',
  docusign: 'DocuSign',
  easypost: 'EasyPost',
  elevenlabs: 'ElevenLabs',
  giphy: 'GIPHY',
  github: 'GitHub',
  godaddy: 'GoDaddy',
  gohighlevel: 'GoHighLevel',
  gumroad: 'Gumroad',
  hubspot: 'HubSpot',
  lemonsqueezy: 'Lemon Squeezy',
  linkedin: 'LinkedIn',
  linkupso: 'Linkup',
  listennotes: 'Listen Notes',
  manychat: 'ManyChat',
  modelcontextprotocol: 'Model Context Protocol',
  monday: 'Monday.com',
  newsapi: 'NewsAPI',
  openai: 'OpenAI',
  openweathermap: 'OpenWeatherMap',
  pagerduty: 'PagerDuty',
  postgrest: 'PostgREST',
  revenuecat: 'RevenueCat',
  sendgrid: 'SendGrid',
  serpapi: 'SerpAPI',
  taxjar: 'TaxJar',
  twitter: 'X',
  uplead: 'UpLead',
  whatsapp: 'WhatsApp',
}

// @note our own abilities lead the catalogue; everything else sorts
// alphabetically behind them.

const PINNED_PROVIDERS = ['cbk']

/**
 * The service an ability template belongs to. Templates carry this, but fall
 * back to the leading segment of the template key - `ably/message/publish` is
 * an Ably one.
 */
export function getTemplateProvider({
  provider,
  template,
  id,
}: {
  provider?: string
  template?: string
  id?: string
}): string {
  return provider || (template ?? id ?? '').split(/[/[]/)[0] || 'other'
}

/**
 * How a provider is spelled.
 */
export function getProviderTitle(provider: string): string {
  return (
    PROVIDER_TITLES[provider] ||
    provider.replace(/\w\S*/g, (word) => {
      return word[0].toUpperCase() + word.slice(1)
    })
  )
}

/**
 * Orders providers for display: pinned ones first, in the order they are
 * pinned, then everything else alphabetically by title.
 */
export function compareProviders(
  a: { id: string; title: string },
  b: { id: string; title: string }
): number {
  const rank = ({ id }: { id: string }) => {
    const index = PINNED_PROVIDERS.indexOf(id)

    return index === -1 ? PINNED_PROVIDERS.length : index
  }

  return rank(a) - rank(b) || a.title.localeCompare(b.title)
}
