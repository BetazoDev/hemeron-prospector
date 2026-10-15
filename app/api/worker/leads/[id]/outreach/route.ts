import { NextRequest, NextResponse } from 'next/server'
import { authenticateWorker } from '@/lib/worker-auth'
import { parseOutreach, saveOutreach } from '@/lib/pipeline/outreach'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** El worker deja los mensajes de contacto y los números por probar de un negocio. */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const auth = authenticateWorker(req)
  if (auth instanceof NextResponse) return auth

  const id = Number((await params).id)
  const outreach = parseOutreach(await req.json().catch(() => null))
  if (!Number.isInteger(id) || !outreach) {
    return NextResponse.json({ error: 'Mensajes inválidos: el segundo debe llevar {nombre} y {demo}' }, { status: 400 })
  }
  return (await saveOutreach(id, outreach)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'No existe ese negocio' }, { status: 404 })
}
