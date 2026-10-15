'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import AppShell, { useShell } from '../components/shell/AppShell'
import ContactCard from '../components/ContactCard'
import { CONTACT_TABS, tabOf, type ContactAction, type ContactLead, type ContactTab } from '../components/contact-types'

const EMPTY: Record<ContactTab, { title: string; text: string }> = {
  pending: { title: 'Nadie por contactar', text: 'Cuando el worker publique una demo, el negocio aparece aquí con sus mensajes listos.' },
  waiting: { title: 'Nadie esperando respuesta', text: 'Aquí quedan los negocios a los que ya les mandaste el primer mensaje.' },
  replied: { title: 'Sin respuestas todavía', text: 'Cuando alguien responda, márcalo y aquí te espera el segundo mensaje con su demo.' },
  talking: { title: 'Ninguna conversación abierta', text: 'Los negocios que ya recibieron su demo aparecen aquí hasta que decidan.' },
  nowa: { title: 'Ningún número sin WhatsApp', text: 'Si un número no tiene WhatsApp, el negocio pasa aquí con los demás números que se encontraron.' },
  closed: { title: 'Nada cerrado todavía', text: 'Aquí quedan los clientes y los que no se interesaron.' },
}

const ACTION_TOAST: Record<ContactAction, string> = {
  sent_m1: 'Queda esperando respuesta',
  no_whatsapp: 'Se probará el siguiente número',
  replied: 'Ahora toca el 2º mensaje con su demo',
  sent_m2: 'Queda en conversación',
  interested: 'Marcado como interesado',
  won: 'Nuevo cliente',
  lost: 'Cerrado',
  reset: 'De vuelta en «Por contactar»',
}

function SignatureField({ value, onSave }: { value: string; onSave: (name: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [last, setLast] = useState(value)
  if (value !== last) {
    setLast(value)
    setDraft(value)
  }
  return (
    <label className="contact-signature">
      <span className="label">Firmas como</span>
      <input
        className="input"
        value={draft}
        placeholder="Tu nombre"
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && draft.trim() !== value && onSave(draft.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  )
}

function Contact() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast, refresh: refreshShell } = useShell()
  const tab = (CONTACT_TABS.some((t) => t.id === params.get('vista')) ? params.get('vista') : 'pending') as ContactTab

  const [leads, setLeads] = useState<ContactLead[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/contact')
      if (res.status === 401) return router.push('/login')
      const json = await res.json()
      setLeads(json.leads ?? [])
      setName(json.displayName ?? '')
    } catch {
      // Lo intenta la siguiente carga.
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  // En el celular las pestañas se desplazan de lado: la seleccionada debe quedar a la vista.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const box = document.querySelector<HTMLElement>('.contact-tabs')
      const el = box?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!box || !el || box.scrollWidth <= box.clientWidth) return
      const offset = el.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft
      box.scrollTo({ left: offset - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(frame)
  }, [tab])

  const counts = useMemo(() => {
    const c = Object.fromEntries(CONTACT_TABS.map((t) => [t.id, 0])) as Record<ContactTab, number>
    for (const l of leads) c[tabOf(l.stage)]++
    return c
  }, [leads])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((l) => tabOf(l.stage) === tab && (!q || `${l.title} ${l.city ?? ''} ${l.phoneDigits ?? ''}`.toLowerCase().includes(q)))
  }, [leads, tab, search])

  const setTab = (id: ContactTab) => router.replace(id === 'pending' ? '/contacto' : `/contacto?vista=${id}`, { scroll: false })

  const handleAction = async (lead: ContactLead, action: ContactAction, number?: string) => {
    setBusy(true)
    try {
      const res = await fetch(`/api/contact/${lead.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, number }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) return toast('No se pudo', json.error ?? 'Intenta de nuevo.', 'error')
      setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, ...json.lead } : l)))
      toast(lead.title, ACTION_TOAST[action])
      refreshShell()
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async (lead: ContactLead, which: 'm1' | 'm2', text: string) => {
    const res = await fetch(`/api/contact/${lead.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ edit: { [which]: text } }),
    }).catch(() => null)
    const json = await res?.json().catch(() => ({}))
    if (!res?.ok) return toast('No se guardó el mensaje', json?.error ?? 'Intenta de nuevo.', 'error')
    setLeads((all) => all.map((l) => (l.id === lead.id ? { ...l, outreach: json.outreach } : l)))
    toast('Mensaje guardado', 'Se usará tal cual para este negocio.')
  }

  const saveName = async (displayName: string) => {
    const res = await fetch('/api/contact', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    }).catch(() => null)
    if (!res?.ok) return toast('No se guardó tu nombre', 'Intenta de nuevo.', 'error')
    setName(displayName)
    toast('Nombre guardado', `El 2º mensaje dirá «Soy ${displayName}, de Hemeron».`)
  }

  const empty = EMPTY[tab]
  const pending = counts.pending

  return (
    <>
      <section className="field-carbon">
        <div className="page page-head">
          <h1 className="display page-title">
            Contacto
            <span className="dim">de las demos publicadas</span>
          </h1>
          <div className="contact-head-row">
            <p className="page-meta">
              <span>
                <strong>{loading ? '–' : pending.toLocaleString('es-MX')}</strong> {pending === 1 ? 'negocio por contactar' : 'negocios por contactar'}
              </span>
            </p>
            <SignatureField value={name} onSave={saveName} />
          </div>
          <div className="legend contact-tabs" role="tablist" aria-label="Etapas del contacto">
            {CONTACT_TABS.map((t) => (
              <button key={t.id} type="button" role="tab" className="legend-item" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label} <span className="num">{counts[t.id]}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="field-niebla work">
        <div className="page">
          <div className="toolbar">
            <div className="search-box">
              <Search aria-hidden="true" />
              <input
                className="input"
                type="search"
                placeholder="Buscar negocio, ciudad o teléfono"
                aria-label="Buscar en contacto"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="contact-list" aria-busy="true">
              {[0, 1].map((i) => (
                <div key={i} className="contact-card skeleton-card">
                  <div className="skeleton contact-thumb" />
                  <div className="contact-body">
                    <div className="skeleton" style={{ height: 22, width: '40%' }} />
                    <div className="skeleton" style={{ height: 80 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : shown.length ? (
            <div className="contact-list">
              {shown.map((lead) => (
                <ContactCard
                  key={lead.id}
                  lead={lead}
                  name={name}
                  busy={busy}
                  onAction={handleAction}
                  onEdit={handleEdit}
                  onCopied={() => toast('Mensaje copiado')}
                />
              ))}
            </div>
          ) : (
            <div className="contact-empty">
              <h2>{search ? 'Sin resultados' : empty.title}</h2>
              <p>{search ? 'Ningún negocio de esta etapa coincide con la búsqueda.' : empty.text}</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default function ContactPage() {
  return (
    <AppShell active="contacto">
      <Suspense fallback={null}>
        <Contact />
      </Suspense>
    </AppShell>
  )
}
