import type { ClaimedLead } from '../api.js'
import { brief } from '../briefs.js'
import { AgentError, runAgent } from '../claude.js'

/** Mensajes de contacto que el Prospector muestra en su página de Contacto. */
export interface OutreachDraft {
  m1: string
  /** Lleva {nombre} y {demo}, que el Prospector llena al enviar. */
  m2: string
  numbers: { digits: string; level: 'alta' | 'media' | 'baja'; source: string }[]
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['m1', 'm2', 'numbers'],
  properties: {
    m1: { type: 'string', description: 'Primer mensaje: solo confirma el número' },
    m2: { type: 'string', description: 'Segundo mensaje, con {nombre} y {demo} literales' },
    numbers: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['digits', 'level', 'source'],
        properties: {
          digits: { type: 'string' },
          level: { type: 'string', enum: ['alta', 'media', 'baja'] },
          source: { type: 'string' },
        },
      },
    },
  },
}

/** Redacta los dos mensajes a partir de lo que ya se investigó; solo lee la carpeta del negocio. */
export async function writeMessages(lead: ClaimedLead, dir: string, onProgress: (t: string) => void): Promise<OutreachDraft> {
  const { output } = await runAgent<OutreachDraft>({
    label: 'Mensajes',
    prompt: brief('message', {
      NAME: lead.title,
      CATEGORY: lead.category,
      CITY: lead.city,
      WEBSITE: lead.siteKind === 'web' ? lead.website : 'no tiene sitio propio',
      DIR: dir,
    }),
    cwd: dir,
    allowedTools: ['Read', 'Glob', 'Grep'],
    disallowedTools: ['Bash', 'WebSearch', 'WebFetch', 'Write', 'Edit'],
    schema: SCHEMA,
    model: 'sonnet',
    maxTurns: 20,
    timeoutMs: 10 * 60_000,
    writableDirs: [dir],
    onProgress,
  })
  if (!output.m2.includes('{nombre}') || !output.m2.includes('{demo}')) {
    throw new AgentError('Mensajes: el segundo mensaje no trae {nombre} y {demo}', true)
  }
  return output
}
