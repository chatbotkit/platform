// @note delivery to the console, for a deployment with no email vendor
// configured. The text body is included because the console IS delivery here:
// sign-in codes and invitations reach the operator nowhere else.

// @note the body is framed with an open left rail rather than a closed box:
// every line stands alone, so long URLs never break the frame and per-line
// log timestamps do not mangle it
export function describe(
  kind: string,
  email: { to: string; subject: string },
  text: string
): void {
  const rule = '─'.repeat(50)

  const body = text
    .trim()
    .split('\n')
    .map((line) => `│ ${line}`)
    .join('\n')

  // eslint-disable-next-line no-console
  console.log(
    `[email:${kind}] to=${email.to} subject=${JSON.stringify(email.subject)} (not delivered: no email provider configured)\n┌${rule}\n${body}\n└${rule}`
  )
}
