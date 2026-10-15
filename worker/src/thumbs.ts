import { config } from './config.js'
import { log } from './log.js'
import { republishThumbnails } from './steps/publish.js'

/** `npm run thumbs -- juridicoruiz otraslug`: regenera y publica sus miniaturas del directorio. */
const slugs = process.argv.slice(2).filter((a) => /^[a-z0-9-]+$/.test(a))
if (!slugs.length) {
  log('thumbs', 'Uso: npm run thumbs -- <slug> [<slug>…]')
  process.exit(1)
}
try {
  const done = await republishThumbnails(slugs, config.basePort + 90, (t) => log('thumbs', t))
  log('thumbs', done.length ? `Publicadas: ${done.join(', ')}` : 'No se publicó ninguna miniatura')
  if (done.length < slugs.length) process.exitCode = 1
} catch (error) {
  log('thumbs', `No se pudo: ${(error as Error).message}`)
  process.exitCode = 1
}
