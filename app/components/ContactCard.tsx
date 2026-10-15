'use client'

import { useState } from 'react'
import { Copy, ExternalLink, MessageCircle, Star } from 'lucide-react'
import {
  ACTION_LABEL,
  currentNumber,
  firstMessage,
  formatNumber,
  numbersFor,
  secondMessage,
  thumbFor,
  triedNumbers,
  waLink,
  type ContactAction,
  type ContactLead,
} from './contact-types'

interface Props {
  lead: ContactLead
  /** Con qué nombre firma el usuario el segundo mensaje. */
  name: string
  busy: boolean
  onAction: (lead: ContactLead, action: ContactAction, number?: string) => void
  onEdit: (lead: ContactLead, which: 'm1' | 'm2', text: string) => void
  onCopied: () => void
}

const LEVEL_LABEL = { alta: 'Lo publica como WhatsApp', media: 'Celular publicado', baja: 'Puede ser fijo' } as const

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/** El mensaje del paso actual, editable. El segundo se edita ya con el nombre y el enlace puestos. */
function MessageBox({ label, text, onSave, onCopied }: { label: string; text: string; onSave: (t: string) => void; onCopied: () => void }) {
  const [draft, setDraft] = useState(text)
  const [lastText, setLastText] = useState(text)
  // Si el mensaje cambia desde fuera (otra etapa, otra versión), se toma el nuevo.
  if (text !== lastText) {
    setLastText(text)
    setDraft(text)
  }
  return (
    <div className="contact-message">
      <div className="contact-message-head">
        <span className="label">{label}</span>
        <button
          type="button"
          className="icon-btn quiet"
          aria-label={`Copiar ${label.toLowerCase()}`}
          onClick={() => {
            navigator.clipboard?.writeText(draft).then(onCopied, () => undefined)
          }}
        >
          <Copy aria-hidden="true" />
        </button>
      </div>
      <textarea
        className="input contact-textarea"
        value={draft}
        rows={Math.min(12, Math.max(2, draft.split('\n').length + 1))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft.trim() && draft !== text && onSave(draft)}
        aria-label={label}
      />
    </div>
  )
}

export default function ContactCard({ lead, name, busy, onAction, onEdit, onCopied }: Props) {
  const number = currentNumber(lead)
  const tried = triedNumbers(lead)
  const others = numbersFor(lead).filter((n) => n.digits !== number?.digits && !tried.has(n.digits))
  const thumb = thumbFor(lead)
  const m1 = firstMessage(lead)
  const m2 = secondMessage(lead, name)
  const last = lead.contactLog.at(-1)
  const stage = lead.stage

  const sendFirst = (digits: string) => (
    <a
      className="wa-btn is-primary"
      href={waLink(digits, m1)}
      target="_blank"
      rel="noreferrer"
      aria-disabled={busy}
      onClick={() => onAction(lead, 'sent_m1', digits)}
    >
      <MessageCircle aria-hidden="true" />
      Enviar 1er mensaje
    </a>
  )
  const openChat = (digits: string) => (
    <a className="btn btn-light btn-sm" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
      Abrir el chat
    </a>
  )
  const act = (action: ContactAction, label: string, digits?: string) => (
    <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => onAction(lead, action, digits)}>
      {label}
    </button>
  )

  return (
    <article className={`contact-card ${stage === 'lost' ? 'is-muted' : ''}`}>
      <a className="contact-thumb" href={lead.demoUrl ?? undefined} target="_blank" rel="noreferrer" aria-label={`Ver la demo de ${lead.title}`}>
        {/* La miniatura vive en el sitio de demos, no en el Prospector: next/image no la optimizaría. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {thumb ? <img src={thumb} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : null}
        <span className="contact-thumb-label">
          Ver demo <ExternalLink aria-hidden="true" />
        </span>
      </a>

      <div className="contact-body">
        <header className="contact-head">
          <h3 className="contact-name">{lead.title}</h3>
          <p className="contact-sub">
            {[lead.category, lead.city].filter(Boolean).join(' · ')}
            {lead.rating ? (
              <span className="lead-google">
                <Star className="star" aria-hidden="true" />
                {lead.rating.toFixed(1)}
                {lead.reviewsCount ? ` (${lead.reviewsCount})` : ''}
              </span>
            ) : null}
          </p>
        </header>

        {number ? (
          <p className="contact-number">
            <span className={`contact-level is-${number.level}`} aria-hidden="true" />
            <strong>{formatNumber(number.digits)}</strong>
            <span>{LEVEL_LABEL[number.level]} · {number.source}</span>
          </p>
        ) : (
          <p className="contact-number is-empty">Ya no quedan números por probar.</p>
        )}

        {(stage === 'published' || stage === 'contacted' || stage === 'no_whatsapp') && (
          <MessageBox label="1er mensaje" text={m1} onSave={(t) => onEdit(lead, 'm1', t)} onCopied={onCopied} />
        )}
        {(stage === 'replied' || stage === 'pitched') &&
          (m2 ? (
            <MessageBox
              label="2º mensaje"
              text={m2}
              onSave={(t) => onEdit(lead, 'm2', t.replaceAll(lead.demoUrl ?? '\u0000', '{demo}').replaceAll(name || '\u0000', '{nombre}'))}
              onCopied={onCopied}
            />
          ) : (
            <p className="contact-note">El 2º mensaje todavía no está listo: el worker lo prepara al publicar la demo.</p>
          ))}

        <div className="contact-actions">
          {stage === 'published' && number && (
            <>
              {sendFirst(number.digits)}
              {act('no_whatsapp', 'Ese número no tiene WhatsApp', number.digits)}
            </>
          )}
          {stage === 'contacted' && number && (
            <>
              <button type="button" className="wa-btn is-primary" disabled={busy} onClick={() => onAction(lead, 'replied')}>
                Respondió
              </button>
              {openChat(number.digits)}
              {act('no_whatsapp', 'No tiene WhatsApp', number.digits)}
            </>
          )}
          {stage === 'no_whatsapp' &&
            (number ? (
              <>
                {sendFirst(number.digits)}
                {act('no_whatsapp', 'Este tampoco', number.digits)}
              </>
            ) : (
              act('lost', 'Cerrar sin contacto')
            ))}
          {stage === 'replied' && number && (
            <>
              {m2 && name ? (
                <a
                  className="wa-btn is-primary"
                  href={waLink(number.digits, m2)}
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={busy}
                  onClick={() => onAction(lead, 'sent_m2', number.digits)}
                >
                  <MessageCircle aria-hidden="true" />
                  Enviar 2º mensaje
                </a>
              ) : (
                <span className="contact-note">{m2 ? 'Escribe arriba con qué nombre firmas para enviarlo.' : null}</span>
              )}
              {openChat(number.digits)}
            </>
          )}
          {stage === 'pitched' && (
            <>
              <button type="button" className="wa-btn is-primary" disabled={busy} onClick={() => onAction(lead, 'interested')}>
                Le interesó
              </button>
              {number && openChat(number.digits)}
              {act('lost', 'No le interesó')}
            </>
          )}
          {stage === 'interested' && (
            <>
              <button type="button" className="wa-btn is-primary" disabled={busy} onClick={() => onAction(lead, 'won')}>
                Se volvió cliente
              </button>
              {number && openChat(number.digits)}
              {act('lost', 'No le interesó')}
            </>
          )}
          {(stage === 'won' || stage === 'lost') && act('reset', 'Reabrir')}
        </div>

        {stage === 'no_whatsapp' && others.length > 0 && (
          <div className="contact-others">
            <span className="label">Otros números</span>
            {others.map((n) => (
              <p key={n.digits} className="contact-number">
                <span className={`contact-level is-${n.level}`} aria-hidden="true" />
                <strong>{formatNumber(n.digits)}</strong>
                <span>{LEVEL_LABEL[n.level]} · {n.source}</span>
              </p>
            ))}
          </div>
        )}

        {last && (
          <p className="contact-log">
            {ACTION_LABEL[last.action]} el {dateLabel(last.at)}
            {last.number ? ` · ${formatNumber(last.number)}` : ''}
          </p>
        )}
      </div>
    </article>
  )
}
