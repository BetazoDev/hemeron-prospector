import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { CONTACT_STAGES } from '@/lib/pipeline/outreach'

export const dynamic = 'force-dynamic'

async function getUserId(req: NextRequest): Promise<string | null> {
  const token = getTokenFromRequest(req)
  const payload = token ? await verifyToken(token) : null
  return payload?.userId ?? null
}

/** Los negocios con demo publicada y su avance de contacto, más el nombre con que firma el usuario. */
export async function GET(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [user, leads] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } }),
    prisma.lead.findMany({
      where: { userId, stage: { in: [...CONTACT_STAGES] }, demoUrl: { not: null } },
      orderBy: { stageChangedAt: 'desc' },
      select: {
        id: true,
        jobId: true,
        title: true,
        category: true,
        city: true,
        rating: true,
        reviewsCount: true,
        website: true,
        mapsUrl: true,
        phoneDigits: true,
        siteWhatsapp: true,
        demoUrl: true,
        demoSlug: true,
        stage: true,
        stageChangedAt: true,
        outreach: true,
        contactNumber: true,
        contactLog: true,
        contactedAt: true,
      },
    }),
  ])
  return NextResponse.json({ displayName: user?.displayName ?? null, leads })
}

/** Guarda el nombre con que firma el segundo mensaje («Soy {nombre}, de Hemeron»). */
export async function PATCH(req: NextRequest) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const name = typeof body?.displayName === 'string' ? body.displayName.trim().replace(/\s+/g, ' ').slice(0, 60) : ''
  if (!name) return NextResponse.json({ error: 'Escribe tu nombre' }, { status: 400 })
  await prisma.user.update({ where: { id: userId }, data: { displayName: name } })
  return NextResponse.json({ displayName: name })
}
