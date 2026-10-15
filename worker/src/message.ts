import fs from 'node:fs'
import path from 'node:path'
import { api, type ClaimedLead } from './api.js'
import { config } from './config.js'
import { log } from './log.js'
import { writeMessages } from './steps/message.js'

/** `npm run message -- juridicoruiz`: prepara los mensajes de contacto de demos ya publicadas. */
const slugs = process.argv.slice(2).filter((a) => /^[a-z0-9-]+$/.test(a))
if (!slugs.length) {
  log('message', 'Uso: npm run message -- <slug> [<slug>…]')
  process.exit(1)
}
for (const slug of slugs) {
  const dir = path.join(config.demosDir, slug)
  try {
    const lead = JSON.parse(fs.readFileSync(path.join(dir, 'lead.json'), 'utf8')) as ClaimedLead
    const draft = await writeMessages(lead, dir, (t) => log('message', t))
    await api.outreach(lead.id, draft)
    log('message', `${slug}: listo, ${draft.numbers.length} número(s)\n--- 1er mensaje ---\n${draft.m1}\n--- 2º mensaje ---\n${draft.m2}`)
  } catch (error) {
    log('message', `${slug}: no se pudo: ${(error as Error).message}`)
    process.exitCode = 1
  }
}
