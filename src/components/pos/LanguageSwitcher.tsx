'use client'

import { useI18n, type Language } from '@/i18n'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Globe } from 'lucide-react'

const languageFlags: Record<Language, string> = {
  sl: '🇸🇮',
  en: '🇬🇧',
  it: '🇮🇹',
}

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="w-4 h-4" />
          <span className="text-base leading-none">{languageFlags[lang]}</span>
          <span className="hidden sm:inline text-xs uppercase">{lang}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setLang('sl')} className="gap-2 cursor-pointer">
          <span className="text-base">🇸🇮</span>
          <span>{t.languages.sl}</span>
          {lang === 'sl' && <span className="ml-auto text-emerald-600">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('en')} className="gap-2 cursor-pointer">
          <span className="text-base">🇬🇧</span>
          <span>{t.languages.en}</span>
          {lang === 'en' && <span className="ml-auto text-emerald-600">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang('it')} className="gap-2 cursor-pointer">
          <span className="text-base">🇮🇹</span>
          <span>{t.languages.it}</span>
          {lang === 'it' && <span className="ml-auto text-emerald-600">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
