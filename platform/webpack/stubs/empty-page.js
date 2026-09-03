// @note stands in for `pages/**/*.utest.*` and `*.stories.*` modules at build
// time. Those files
// match `pageExtensions` and are therefore compiled as routes; without this
// stub Next evaluates them while collecting page data and trips on jest
// globals. The route still exists (as before) but renders nothing.
export default function EmptyPage() {
  return null
}
