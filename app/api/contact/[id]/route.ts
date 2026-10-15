import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { editMessages, isContactAction, recordContact } from '@/lib/pipeline/outreach'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Un paso del contacto (`{ action, number? }`) o la corrección de un mensaje (`{ edit: { m1?, m2? } }`). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  if (!payload?.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number((await params).id)
  const body = await req.json().catch(() => null)
  if (!Number.isInteger(id) || id <= 0 || !body) return NextResponse.json({ error: 'Solicitud incompleta' }, { status: 400 })

  if (body.edit) {
    const outreach = await editMessages(payload.userId, id, body.edit)
    return outreach ? NextResponse.json({ outreach }) : NextResponse.json({ error: 'Este negocio todavía no tiene mensajes' }, { status: 404 })
  }
  if (!isContactAction(body.action)) return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  const lead = await recordContact(payload.userId, id, body.action, typeof body.number === 'string' ? body.number : null)
  return lead
    ? NextResponse.json({ lead: { id: lead.id, stage: lead.stage, contactNumber: lead.contactNumber, contactLog: lead.contactLog, contactedAt: lead.contactedAt } })
    : NextResponse.json({ error: 'Este negocio no está en contacto' }, { status: 404 })
}
