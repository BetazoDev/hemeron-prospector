/**
 * Cómo se reconoce que dos negocios son el mismo: el mismo lugar de Google Maps, el mismo
 * teléfono, el mismo dominio o el mismo nombre en la misma ciudad.
 */

export interface LeadIdentity {
  title: string
  city?: string | null
  placeId?: string | null
  mapsUrl?: string | null
  phoneDigits?: string | null
  domain?: string | null
}

function fold(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Claves con las que un negocio se reconoce como el mismo. */
export function identityKeys(lead: LeadIdentity): string[] {
  const keys: string[] = []
  if (lead.placeId) keys.push(`place:${lead.placeId}`)
  const cid = lead.mapsUrl?.match(/[?&]cid=(\d+)/)?.[1]
  if (cid) keys.push(`cid:${cid}`)
  if (lead.phoneDigits && lead.phoneDigits.length >= 10) keys.push(`phone:${lead.phoneDigits.slice(-10)}`)
  // En hosts compartidos (sites.google.com/view/x) el dominio ya trae su ruta: se compara completo.
  if (lead.domain) keys.push(`domain:${lead.domain.toLowerCase().replace(/^www\./, '')}`)
  const name = fold(lead.title)
  if (name && name !== 'sin nombre') keys.push(`name:${name}|${fold(lead.city ?? '')}`)
  return keys
}
