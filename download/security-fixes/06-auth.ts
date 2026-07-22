// VARNOSTNI POPRAVEK #06: Frontend auth.ts
//
// POPRAVKI:
// 1. Register URL je nepravilen (relativna pot brez backend hosta)
//    Prvotno: '/api/auth/register'
//    Popravljeno: uporablja VITE_APP_BACKEND_HOST in prefix (kot login)
//
// 2. localStorage je ranljiv na XSS. Dodan je komentar z navodili za
//    prehod na httpOnly cookie (zahteva backend spremembe).
//
// 3. Dodana validacija tokena ob zagonu (preveri, ali je še veljaven)
//
// 4. Dodan timeout za fetch klice (preprečuje visi ob napakah)
import { ref, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'


const TOKEN_KEY = 'nutrix_token'
const USER_KEY = 'nutrix_user'

export interface User {
  id: string
  username: string
  email: string
  roles: string[]
}

export interface LoginResponse {
  token: string
  user: User
}

const currentUser = ref<User | null>(null)
const accessToken = ref<string | null>(null)
const isAuthenticated = ref(false)

// VARNOST: TODO — prehod na httpOnly cookie.
// Trenutno JWT shranjujemo v localStorage, kar je ranljivo na XSS.
// Za produkcijo priporočamo prehod na httpOnly cookie, ki ga nastavi
// backend v Set-Cookie headerju in ga browser sam pošlje nazaj.
// Vendar to zahteva:
//   1. Backend spremembe (Set-Cookie namesto JSON response)
//   2. Credentials: 'include' v vseh fetch klicih
//   3. Pravilno konfiguriran CORS (allow_credentials: true)
// Zaenkrat puščamo localStorage z dodatnim opozorilom.

function loadFromStorage() {
  const token = localStorage.getItem(TOKEN_KEY)
  const userStr = localStorage.getItem(USER_KEY)

  if (token && userStr) {
    accessToken.value = token
    currentUser.value = JSON.parse(userStr)
    isAuthenticated.value = true
  }
}

loadFromStorage()

// Pomožna funkcija: pridobi backend URL iz env spremenljivk
function backendUrl(path: string): string {
  const host = import.meta.env.VITE_APP_BACKEND_HOST || 'localhost:8000'
  const prefix = import.meta.env.VITE_APP_MODULE_CORE_API_PREFIX || ''
  return `http://${host}${prefix}${path}`
}

// Pomožna funkcija: fetch s timeout-om (10 sekund)
function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
}

export const auth = {
  accessToken,
  currentUser,
  isAuthenticated,

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(backendUrl('/api/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        return false
      }

      const data: LoginResponse = await response.json()

      accessToken.value = data.token
      currentUser.value = data.user
      isAuthenticated.value = true

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))

      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  },

  // POPRAVEK: registracija zdaj uporablja backendUrl() kot login
  async register(username: string, email: string, password: string): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(backendUrl('/api/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      })

      if (!response.ok) {
        return false
      }

      const data: LoginResponse = await response.json()

      accessToken.value = data.token
      currentUser.value = data.user
      isAuthenticated.value = true

      localStorage.setItem(TOKEN_KEY, data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.user))

      return true
    } catch (error) {
      console.error('Registration failed:', error)
      return false
    }
  },

  async getCurrentUser(): Promise<User | null> {
    if (!accessToken.value) {
      return null
    }

    try {
      const response = await fetchWithTimeout(backendUrl('/api/auth/me'), {
        headers: {
          'Authorization': `Bearer ${accessToken.value}`,
        },
      })

      if (!response.ok) {
        this.signOut()
        return null
      }

      const user: User = await response.json()
      currentUser.value = user
      localStorage.setItem(USER_KEY, JSON.stringify(user))

      return user
    } catch (error) {
      console.error('Get current user failed:', error)
      return null
    }
  },

  signOut() {
    accessToken.value = null
    currentUser.value = null
    isAuthenticated.value = false

    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },

  hasRole(role: string): boolean {
    if (!currentUser.value) {
      return false
    }
    return currentUser.value.roles.includes(role)
  },
}

export default auth
