// @note the signup domain blacklist - a built-in anti-abuse control against
// disposable and throwaway addresses, maintained here for every deployment.
// One shared list is better protection than a swappable one that most
// deployments would leave empty.
//
// An entry matches the domain itself and every subdomain of it (`example.com`
// bans `example.com` and `mail.example.com`). A bare TLD entry (`cfd`)
// therefore bans every domain on that TLD - use those only for TLDs that
// produce nothing but abuse.

import wildcard from 'disposable-email-domains/wildcard.json'

/** Email domains refused at signup. */
export const domains: string[] = [
  // The maintained disposable-email wildcard list.
  ...wildcard,

  // Hand-collected abuse intelligence gathered from signup traffic.
  'myhome-server.de',
  'lebetrust.org',
  'throwawaymail.com',
  'lanxiu233.com',
  'nimail.cn',
  'indoxs.bond',
  'sportcornwall.org',
  'dmcelements.org',
  'havertz.tk',
  '0cpub2.tech',
  'dynv6.net',
  'yorushika.one',
  'siempre.gratis',
  'aaconservation.org',
  'linlin.cloud',
  'linux-do.me',
  'indevs.in',
  'hulisang.edu.kg',
  'freemails.pp.ua',
  'abrdns.com',
  'plugintonature.org.uk',
  'ycglobalmovement.com',
  'nyc.mn',
  'novaprime.vip',
  'tokenized.name',
  'thinktank.edu.kg',
  'ahavaexperience.com',
  'chanceforfuture.org',
  'mwalshabs.dev',
  'positivevoiceteesvalley.co.uk',
  'us.ci',
  'alarafoundation.com',
  'mailtao.me',
  'acg-news.com',
  'churchinsouthampton.org.uk',
  'wearvault.biz.id',
  'sylu.net',
  'thameschamberorchestra.co.uk',
  'baileybridge.org',
  'jobsma.pp.ua',
  'freeddns.org',
  'abilityaccesslegal.org',
  'xiwinnie.icu',
  'cuvrs.info',
  'lordfortescue.org.uk',
  'qzz.io',
  'fightingzebras.org',
  'vvvv.ee',
  'slimirin.com',
  'de5.net',
  'zutomayo.best',
  'idu4aa4.info',
  'markableytrust.org.uk',
  'x80la.shop',
  'bcmail.pro',
  'caowo.online',
  'dpdns.org',
  'ggff.net',
  'supergrok.site',
  'eu.org',
  'cc.cd',

  // Bare TLD bans.
  'cfd',
  'cc',
  'top',
  'xyz',
  'sbs',
]
