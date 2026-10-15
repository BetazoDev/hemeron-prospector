/** Tipos y reglas del contacto que comparten la página y sus tarjetas (sin dependencias de servidor). */

export interface OutreachNumber {
  digits: string
  level: 'alta' | 'media' | 'baja'
  source: string
}

export interface Outreach {
  m1: string
  m2: string
  numbers: OutreachNumber[]
  generatedAt: string
  editedAt?: string
}

export type ContactAction = 'sent_m1' | 'no_whatsapp' | 'replied' | 'sent_m2' | 'interested' | 'won' | 'lost' | 'reset'

export interface ContactEntry {
  at: string
  action: ContactAction
  number?: string
}

export interface ContactLead {
  id: number
  jobId: number
  title: string
  category: string | null
  city: string | null
  rating: number | null
  reviewsCount: number | null
  website: string | null
  mapsUrl: string | null
  phoneDigits: string | null
  siteWhatsapp: string[]
  demoUrl: string | null
  demoSlug: string | null
  stage: string
  stageChangedAt: string | null
  outreach: Outreach | null
  contactNumber: string | null
  contactLog: ContactEntry[]
  contactedAt: string | null
}

/** Pestañas de la página, en el orden del proceso. */
export const CONTACT_TABS = [
  { id: 'pending', label: 'Por contactar', stages: ['published'] },
  { id: 'waiting', label: 'Esperando respuesta', stages: ['contacted'] },
  { id: 'replied', label: 'Respondieron', stages: ['replied'] },
  { id: 'talking', label: 'En conversación', stages: ['pitched', 'interested'] },
  { id: 'nowa', label: 'Sin WhatsApp', stages: ['no_whatsapp'] },
  { id: 'closed', label: 'Cerrados', stages: ['won', 'lost'] },
] as const

export type ContactTab = (typeof CONTACT_TABS)[number]['id']

export function tabOf(stage: string): ContactTab {
  return CONTACT_TABS.find((t) => (t.stages as readonly string[]).includes(stage))?.id ?? 'pending'
}

/** Números por probar: los que encontró la investigación o, si no hay, los de su sitio y su ficha. */
export function numbersFor(lead: ContactLead): OutreachNumber[] {
  if (lead.outreach?.numbers.length) return lead.outreach.numbers
  const list: OutreachNumber[] = lead.siteWhatsapp.map((digits) => ({ digits, level: 'alta', source: 'WhatsApp de su sitio' }))
  if (lead.phoneDigits && !lead.siteWhatsapp.includes(lead.phoneDigits)) {
    list.push({ digits: lead.phoneDigits, level: 'baja', source: 'Teléfono de su ficha de Google' })
  }
  return list
}

/** Números que ya se probaron y no tienen WhatsApp. */
export function triedNumbers(lead: ContactLead): Set<string> {
  return new Set(lead.contactLog.filter((e) => e.action === 'no_whatsapp' && e.number).map((e) => e.number!))
}

/** El número que toca: el que ya respondió, o el primero que no se ha descartado. */
export function currentNumber(lead: ContactLead): OutreachNumber | null {
  const numbers = numbersFor(lead)
  if (lead.contactNumber) {
    return numbers.find((n) => n.digits === lead.contactNumber) ?? { digits: lead.contactNumber, level: 'media', source: 'Número con que se le escribió' }
  }
  const tried = triedNumbers(lead)
  return numbers.find((n) => !tried.has(n.digits)) ?? null
}

/** 523314474428 → 33 1447 4428; 524422291204 → 442 229 1204. */
export function formatNumber(digits: string): string {
  const n = digits.startsWith('52') && digits.length === 12 ? digits.slice(2) : digits
  if (n.length !== 10) return digits
  return ['55', '56', '33', '81'].includes(n.slice(0, 2)) ? `${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}` : `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
}

/** El primer mensaje, o uno genérico si el worker todavía no preparó los suyos. */
export function firstMessage(lead: ContactLead): string {
  return lead.outreach?.m1 ?? `Hola, buen día. ¿Es el WhatsApp de ${lead.title}? Me gustaría hablar con alguien del negocio.`
}

/** El segundo mensaje con el nombre de quien escribe y el enlace de la demo. */
export function secondMessage(lead: ContactLead, name: string): string | null {
  if (!lead.outreach) return null
  return lead.outreach.m2.replaceAll('{nombre}', name || '{nombre}').replaceAll('{demo}', lead.demoUrl ?? '')
}

export function waLink(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Miniatura que el worker publica junto a la demo. */
export function thumbFor(lead: ContactLead): string | null {
  if (!lead.demoUrl || !lead.demoSlug) return null
  try {
    return `${new URL(lead.demoUrl).origin}/thumbs/p-${lead.demoSlug}.webp`
  } catch {
    return null
  }
}

export const ACTION_LABEL: Record<ContactAction, string> = {
  sent_m1: '1er mensaje',
  no_whatsapp: 'Sin WhatsApp',
  replied: 'Respondió',
  sent_m2: '2º mensaje',
  interested: 'Le interesó',
  won: 'Cliente',
  lost: 'No le interesó',
  reset: 'Reabierto',
}
