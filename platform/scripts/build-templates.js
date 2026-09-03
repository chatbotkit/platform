// -@ts-check
import 'dotenv/config'

import { exit } from '@/lib/debug'

async function main() {
  // @note disabled because we manage our own index for simplicity
  // const response = await fetch(
  //   'https://raw.githubusercontent.com/chatbotkit/cbk-templates/main/instructions.yaml'
  // )
  // if (!response.ok) {
  //   throw await getFetchError(response)
  // }
  // await fs.promises.writeFile('data/instructions.yaml', response.body)
}

main().catch(exit)
