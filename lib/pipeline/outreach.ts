import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'
import type { Stage } from './stages'

/**
 * Contacto por WhatsApp, como se hacía en /contacto del sitio de demos: un primer mensaje
 * que solo confirma el número y, cuando responden, el segundo con lo que vimos en su sitio,
 * la demo, la auditoría gratuita y la pregunta de cierre. El worker los redacta al publicar
 * la demo; aquí se guardan, se editan y se lleva el avance. Enviar siempre es a mano: el
 * botón abre WhatsApp con el mensaje listo.
 */

export interface OutreachNumber {
  /** Con código de país, solo dígitos: 523312345678. */
  digits: string
  /** alta: lo publican como WhatsApp; media: celular publicado; baja: fijo o dudoso. */
  level: 'alta' | 'media' | 'baja'
  source: string
}

export interface Outreach {
  m1: string
  /** Lleva {nombre} y {demo}, que se llenan al enviar. */
  m2: string
  numbers: OutreachNumber[]
  generatedAt: string
  editedAt?: string
}

export interface ContactEntry {
  at: string
  action: ContactAction
  number?: string
}

/** Etapas desde las que un negocio aparece en Contacto. */
export const CONTACT_STAGES = ['published', 'contacted', 'no_whatsapp', 'replied', 'pitched', 'interested', 'won', 'lost'] as const

export const CONTACT_ACTIONS = {
  sent_m1: { stage: 'contacted', label: 'Envió el 1er mensaje' },
  no_whatsapp: { stage: 'no_whatsapp', label: 'Ese número no tiene WhatsApp' },
  replied: { stage: 'replied', label: 'Respondió' },
  sent_m2: { stage: 'pitched', label: 'Envió el 2º mensaje' },
  interested: { stage: 'interested', label: 'Le interesó' },
  won: { stage: 'won', label: 'Se volvió cliente' },
  lost: { stage: 'lost', label: 'No le interesó' },
  reset: { stage: 'published', label: 'Volvió a «Por contactar»' },
} as const satisfies Record<string, { stage: Stage; label: string }>

export type ContactAction = keyof typeof CONTACT_ACTIONS

export function isContactAction(value: unknown): value is ContactAction {
  return typeof value === 'string' && value in CONTACT_ACTIONS
}

const MAX_LOG = 50

function cleanDigits(value: unknown): string | null {
  const d = String(value ?? '').replace(/\D/g, '')
  if (d.length === 10) return `52${d}`
  if (d.length === 13 && d.startsWith('521')) return `52${d.slice(3)}`
  return d.length >= 11 && d.length <= 15 ? d : null
}

/** Valida lo que manda el worker: dos mensajes con sus marcadores y números limpios, sin repetir. */
export function parseOutreach(body: unknown): Omit<Outreach, 'generatedAt'> | null {
  const b = body as { m1?: unknown; m2?: unknown; numbers?: unknown } | null
  if (!b || typeof b.m1 !== 'string' || typeof b.m2 !== 'string') return null
  const m1 = b.m1.trim().slice(0, 600)
  const m2 = b.m2.trim().slice(0, 3000)
  if (!m1 || !m2.includes('{nombre}') || !m2.includes('{demo}')) return null
  const seen = new Set<string>()
  const numbers: OutreachNumber[] = []
  for (const n of Array.isArray(b.numbers) ? b.numbers : []) {
    const digits = cleanDigits((n as OutreachNumber)?.digits)
    if (!digits || seen.has(digits)) continue
    seen.add(digits)
    const level = (n as OutreachNumber).level
    numbers.push({
      digits,
      level: level === 'alta' || level === 'media' ? level : 'baja',
      source: String((n as OutreachNumber).source ?? '').slice(0, 160),
    })
  }
  return { m1, m2, numbers: numbers.slice(0, 6) }
}

/**
 * Guarda los mensajes que preparó el worker. Si el usuario ya editó los suyos, se respetan
 * y solo se actualizan los números.
 */
export async function saveOutreach(leadId: number, data: Omit<Outreach, 'generatedAt'>) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { outreach: true } })
  if (!lead) return false
  const current = lead.outreach as Outreach | null
  const next: Outreach = current?.editedAt
    ? { ...current, numbers: data.numbers }
    : { ...data, generatedAt: new Date().toISOString() }
  await prisma.lead.update({ where: { id: leadId }, data: { outreach: next as unknown as Prisma.InputJsonValue } })
  return true
}

/** Un paso del contacto: avanza la etapa y lo deja en el historial. */
export async function recordContact(userId: string, leadId: number, action: ContactAction, number?: string | null) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId }, select: { id: true, stage: true, contactLog: true, contactedAt: true } })
  if (!lead) return null
  if (!(CONTACT_STAGES as readonly string[]).includes(lead.stage)) return null

  const now = new Date()
  const digits = number ? cleanDigits(number) : null
  const entry: ContactEntry = { at: now.toISOString(), action, ...(digits ? { number: digits } : {}) }
  const log = [...((Array.isArray(lead.contactLog) ? lead.contactLog : []) as unknown as ContactEntry[]), entry].slice(-MAX_LOG)
  return prisma.lead.update({
    where: { id: leadId },
    data: {
      stage: CONTACT_ACTIONS[action].stage,
      stageChangedAt: now,
      contactLog: log as unknown as Prisma.InputJsonValue,
      ...(digits && action !== 'no_whatsapp' ? { contactNumber: digits } : {}),
      ...(action === 'sent_m1' && !lead.contactedAt ? { contactedAt: now } : {}),
    },
  })
}

/** El usuario corrige un mensaje: desde entonces el worker ya no lo reescribe. */
export async function editMessages(userId: string, leadId: number, edits: { m1?: string; m2?: string }) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, userId }, select: { outreach: true } })
  const current = lead?.outreach as Outreach | null
  if (!current) return null
  const next: Outreach = {
    ...current,
    ...(typeof edits.m1 === 'string' && edits.m1.trim() ? { m1: edits.m1.trim().slice(0, 600) } : {}),
    ...(typeof edits.m2 === 'string' && edits.m2.trim() ? { m2: edits.m2.trim().slice(0, 3000) } : {}),
    editedAt: new Date().toISOString(),
  }
  await prisma.lead.update({ where: { id: leadId }, data: { outreach: next as unknown as Prisma.InputJsonValue } })
  return next
}
