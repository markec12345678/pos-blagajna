'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { sl, type Translations } from './locales/sl'
import { en } from './locales/en'
import { it } from './locales/it'

export type Language = 'sl' | 'en' | 'it'

const translations: Record<Language, Translations> = { sl, en, it }
const STORAGE_KEY = 'pos-language'

interface I18nContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: Translations
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('sl')

  // Naloži jezik iz localStorage ob mountu
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null
      if (saved && ['sl', 'en', 'it'].includes(saved)) {
        setLangState(saved)
      } else {
        // Poišči jezik brskalnika
        const browserLang = navigator.language.split('-')[0]
        if (['sl', 'en', 'it'].includes(browserLang)) {
          setLangState(browserLang as Language)
        }
      }
    } catch {}
  }, [])

  const setLang = (newLang: Language) => {
    setLangState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
    } catch {}
  }

  const t = translations[lang] || sl

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Fallback za komponente, ki niso znotraj provider-ja
    return { lang: 'sl' as Language, setLang: () => {}, t: sl }
  }
  return ctx
}

// Helper za formatiranje datuma glede na jezik
export function useDateFormat() {
  const { lang } = useI18n()
  const locales: Record<Language, string> = {
    sl: 'sl-SI',
    en: 'en-GB',
    it: 'it-IT',
  }
  return (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(locales[lang], {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }
}

// Helper za formatiranje datuma brez ure
export function useDateOnlyFormat() {
  const { lang } = useI18n()
  const locales: Record<Language, string> = {
    sl: 'sl-SI',
    en: 'en-GB',
    it: 'it-IT',
  }
  return (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(locales[lang], {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d)
  }
}

// Helper za formatiranje valute (vedno EUR zaenkrat)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('sl-SI', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
