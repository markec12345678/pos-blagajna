// E2E testi — kritične poti POS sistema
// Zaženi z: npx cypress run --e2e

describe('POS Blagajna — Kritične poti', () => {

  // ============================================
  // 1. LOGIN FLOW
  // ============================================
  describe('Login', () => {
    it('prikaže login stran', () => {
      cy.visit('/login')
      cy.get('input[placeholder*="Uporabniško"]', { timeout: 10000 }).should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
      cy.get('button[type="submit"]').should('contain', 'Prijavi')
    })

    it(' zavrne napačno geslo', () => {
      cy.visit('/login')
      cy.get('input[placeholder*="Uporabniško"]').type('admin')
      cy.get('input[type="password"]').type('napacno{enter}')
      cy.contains('Napačno', { timeout: 5000 }).should('be.visible')
    })

    it('prijavi admina in preusmeri na blagajno', () => {
      cy.visit('/login')
      cy.get('input[placeholder*="Uporabniško"]').type('admin')
      cy.get('input[type="password"]').type('admin123{enter}')
      cy.url().should('eq', Cypress.config().baseUrl + '/')
      cy.contains('Restavracija', { timeout: 10000 }).should('be.visible')
    })
  })

  // ============================================
  // 2. CATALOG IN KOSARICA
  // ============================================
  describe('Katalog in košarica', () => {
    beforeEach(() => {
      cy.login('admin', 'admin123')
    })

    it('prikaže izdelke in kategorije', () => {
      cy.contains('Vsi').should('be.visible')
      cy.contains('Pijače').should('be.visible')
      cy.contains('Hrana').should('be.visible')
      cy.get('button:contains("€")').should('have.length.gt', 5)
    })

    it('doda izdelek v košarico', () => {
      cy.get('button:contains("€")').first().click()
      cy.contains('Košarica').should('be.visible')
      cy.contains('1').should('be.visible') // badge count
    })

    it('filtrira po kategoriji', () => {
      cy.contains('Pijače').click()
      cy.get('button:contains("€")').should('have.length.gt', 0)
    })

    it('spremeni količino v košarici', () => {
      cy.get('button:contains("€")').first().click()
      cy.get('button').contains('+').click()
      cy.contains('× 2').should('be.visible')
    })
  })

  // ============================================
  // 3. CHECKOUT FLOW
  // ============================================
  describe('Checkout', () => {
    beforeEach(() => {
      cy.login('admin', 'admin123')
    })

    it('odpre checkout dialog', () => {
      cy.get('button:contains("€")').first().click()
      cy.contains('Zaključi prodajo').click()
      cy.contains('Način plačila').should('be.visible')
      cy.contains('Gotovina').should('be.visible')
      cy.contains('Kartica').should('be.visible')
    })

    it('izbere gotovino in vnese znesek', () => {
      cy.get('button:contains("€")').first().click()
      cy.contains('Zaključi prodajo').click()
      cy.contains('Gotovina').click()
      cy.get('input[type="number"]').first().type('100')
      cy.contains('Vračilo').should('be.visible')
    })
  })

  // ============================================
  // 4. ADMIN PANEL
  // ============================================
  describe('Admin panel', () => {
    beforeEach(() => {
      cy.login('admin', 'admin123')
    })

    it('odpre admin tab', () => {
      cy.contains('Admin').click()
      cy.contains('Admin panel').should('be.visible')
      cy.contains('Pregled').should('be.visible')
      cy.contains('Uporabniki').should('be.visible')
      cy.contains('Nastavitve').should('be.visible')
    })

    it('prikaže dashboard z metrikami', () => {
      cy.contains('Admin').click()
      cy.contains('Pregled').click()
      cy.contains('Skupna prodaja').should('be.visible')
      cy.contains('Število računov').should('be.visible')
    })

    it('prikaže zgodovino prodaje', () => {
      cy.contains('Admin').click()
      cy.contains('Zgodovina').click()
      cy.contains('Zadnja prodaja').should('be.visible')
    })
  })

  // ============================================
  // 5. JAVNI MENI (/menu)
  // ============================================
  describe('Javni meni', () => {
    it('prikaže javni meni brez prijave', () => {
      cy.visit('/menu')
      cy.contains('Restavracija', { timeout: 10000 }).should('be.visible')
      cy.contains('Vsi').should('be.visible')
      cy.get('button:contains("€")').should('have.length.gt', 5)
    })

    it('odpre rezervacijski dialog', () => {
      cy.visit('/menu')
      cy.contains('Rezerviraj').click()
      cy.contains('Rezervacija').should('be.visible')
    })
  })

  // ============================================
  // 6. LANGUAGE SWITCHER
  // ============================================
  describe('Jezikovni stikalo', () => {
    it('preklopi na angleščino', () => {
      cy.visit('/login')
      cy.get('button').contains('🇸🇮').click()
      cy.contains('English').click()
      cy.contains('Username').should('be.visible')
      cy.contains('Password').should('be.visible')
      cy.contains('Sign in').should('be.visible')
    })

    it('preklopi na italijanščino', () => {
      cy.visit('/login')
      cy.get('button').contains('🇸🇮').click()
      cy.contains('Italiano').click()
      cy.contains('Nome utente').should('be.visible')
      cy.contains('Password').should('be.visible')
      cy.contains('Accedi').should('be.visible')
    })
  })

  // ============================================
  // 7. RATE LIMITING
  // ============================================
  describe('Rate limiting', () => {
    it('blokira po 5 napačnih poskusih', () => {
      cy.visit('/login')
      for (let i = 0; i < 5; i++) {
        cy.get('input[placeholder*="Uporabniško"]').clear().type('admin')
        cy.get('input[type="password"]').clear().type(`wrong${i}{enter}`)
        cy.contains('Napačno', { timeout: 3000 }).should('be.visible')
      }
      // 6. poskus naj bi biti blokiran
      cy.get('input[placeholder*="Uporabniško"]').clear().type('admin')
      cy.get('input[type="password"]').clear().type('wrong{enter}')
      cy.contains('Preveč', { timeout: 3000 }).should('be.visible')
    })
  })

  // ============================================
  // 8. LOGOUT
  // ============================================
  describe('Logout', () => {
    it('odjavi in preusmeri na login', () => {
      cy.login('admin', 'admin123')
      cy.get('button').contains('Odjava').click()
      cy.url().should('include', '/login')
    })
  })
})

// ============================================
// Custom commands
// ============================================
Cypress.Commands.add('login', (username: string, password: string) => {
  cy.session([username, password], () => {
    cy.visit('/login')
    cy.get('input[placeholder*="Uporabniško"]').clear().type(username)
    cy.get('input[type="password"]').clear().type(`${password}{enter}`)
    cy.url().should('eq', Cypress.config().baseUrl + '/')
  })
})
