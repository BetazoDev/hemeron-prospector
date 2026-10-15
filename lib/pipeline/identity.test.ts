import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { identityKeys } from './identity'

const same = (a: Parameters<typeof identityKeys>[0], b: Parameters<typeof identityKeys>[0]) =>
  identityKeys(a).some((k) => identityKeys(b).includes(k))

describe('repetidos entre búsquedas', () => {
  it('reconoce el mismo lugar de Google Maps', () => {
    assert.ok(same({ title: 'Jurídico Ruiz', placeId: 'ChIJ1' }, { title: 'Juridico Ruiz Abogados', placeId: 'ChIJ1' }))
  })
  it('reconoce el mismo teléfono con o sin código de país', () => {
    assert.ok(same({ title: 'A', phoneDigits: '523314474428' }, { title: 'B', phoneDigits: '3314474428' }))
  })
  it('reconoce el mismo nombre en la misma ciudad, sin importar acentos ni mayúsculas', () => {
    assert.ok(same({ title: 'Jurídico Ruiz', city: 'Guadalajara' }, { title: 'JURIDICO RUIZ', city: 'guadalajara' }))
  })
  it('no confunde el mismo nombre en otra ciudad', () => {
    assert.ok(!same({ title: 'Jurídico Ruiz', city: 'Guadalajara' }, { title: 'Jurídico Ruiz', city: 'Monterrey' }))
  })
  it('no junta negocios distintos en el mismo host compartido', () => {
    assert.ok(!same({ title: 'A', domain: 'sites.google.com/view/a' }, { title: 'B', domain: 'sites.google.com/view/b' }))
    assert.ok(same({ title: 'A', domain: 'www.ruiz.mx' }, { title: 'B', domain: 'ruiz.mx' }))
  })
})
