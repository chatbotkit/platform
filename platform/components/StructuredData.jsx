import Head from 'next/head'

/**
 * Serialize a value to JSON that is safe to embed inside an inline
 * `<script>` element.
 *
 * The raw output of `JSON.stringify` can contain sequences such as
 * `</script>`, `<script>` or `<!--` when the data holds user-generated
 * content (e.g. a conversation transcript on a public hub page). The HTML
 * parser would treat `</script>` as the end of the script element, spilling
 * the rest of the JSON into the document and — crucially — pushing Next's
 * `<meta name="next-head-count">` out of `<head>`. The client head-manager
 * then reads `null.content` and throws
 * "Cannot read properties of null (reading 'content')" on the next head
 * update. It is also a stored-XSS vector.
 *
 * `<`, `>` and `&` never appear as JSON structural tokens, so they only ever
 * occur inside string values; replacing them with their `\uXXXX` escapes
 * keeps the parsed JSON identical while making break-out impossible.
 * U+2028/U+2029 are valid in JSON strings but are line terminators in JS, so
 * we escape them too for good measure.
 */
function serializeStructuredData(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export default function StructuredData({ data }) {
  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(data),
        }}
      />
    </Head>
  )
}
