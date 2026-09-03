import metascraperCore, { type Metadata } from 'metascraper'
import metascraperAmazon from 'metascraper-amazon'
import metascraperAuthor from 'metascraper-author'
import metascraperDate from 'metascraper-date'
import metascraperDescription from 'metascraper-description'
import metascraperImage from 'metascraper-image'
import metascraperInstagram from 'metascraper-instagram'
import metascraperLang from 'metascraper-lang'
import metascraperLogo from 'metascraper-logo'
import metascraperLogoFavicon from 'metascraper-logo-favicon'
import metascraperPublisher from 'metascraper-publisher'
import metascraperTitle from 'metascraper-title'
import metascraperTwitter from 'metascraper-twitter'
import metascraperUrl from 'metascraper-url'
// import metascraperVideo from 'metascraper-video'
import metascraperYoutube from 'metascraper-youtube'

const metascraper = metascraperCore([
  metascraperUrl(),
  metascraperLang(),
  metascraperLogoFavicon(),
  metascraperLogo(),
  metascraperDate(),
  metascraperImage(),
  // metascraperVideo(), // @note video is evaling js hence disabled
  metascraperTitle(),
  metascraperDescription(),
  metascraperAuthor(),
  metascraperPublisher(),
  metascraperAmazon(),
  metascraperTwitter(),
  metascraperYoutube(),
  metascraperInstagram(),
])

interface UnfurlOptions {
  url: string
  html: string
}

/**
 * Extracts metadata from HTML content using metascraper
 */
export async function unfurl({ url, html }: UnfurlOptions): Promise<Metadata> {
  return await metascraper({ url, html, validateUrl: false })
}

export default unfurl
