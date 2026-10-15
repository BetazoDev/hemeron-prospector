import { prisma } from '../prisma'
import { identityKeys, type LeadIdentity } from './identity'

/**
 * Una búsqueda nueva suele traer negocios que ya están en otra base. Se descartan sin avisar:
 * el mismo lugar de Google Maps, el mismo teléfono, el mismo dominio (dos sucursales con el
 * mismo sitio comparten rediseño) o el mismo nombre en la misma ciudad.
 */

/** Quita los repetidos dentro del mismo lote y los que ya existen en otras bases del usuario. */
export async function dropKnownLeads<T extends LeadIdentity>(userId: string, jobId: number, leads: T[]): Promise<T[]> {
  const existing = await prisma.lead.findMany({
    // La base que se está guardando se reescribe entera; sus propios leads no cuentan.
    where: { userId, jobId: { not: jobId } },
    select: { title: true, city: true, placeId: true, mapsUrl: true, phoneDigits: true, domain: true },
  })
  const seen = new Set(existing.flatMap(identityKeys))
  const kept: T[] = []
  for (const lead of leads) {
    const keys = identityKeys(lead)
    if (keys.some((k) => seen.has(k))) continue
    keys.forEach((k) => seen.add(k))
    kept.push(lead)
  }
  return kept
}
