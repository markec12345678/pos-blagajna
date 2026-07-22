'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, RefreshCw, ChevronDown, ChevronRight, Lock, Unlock,
  Box, Tag, FileText,
} from 'lucide-react'

interface OpenApiPath {
  [method: string]: {
    summary: string
    tags: string[]
    security?: any[]
    parameters?: any[]
    responses?: Record<string, { description: string }>
  }
}

interface OpenApiSpec {
  info: { title: string; version: string; description: string }
  paths: Record<string, OpenApiPath>
  tags: Array<{ name: string; description: string }>
}

const methodColors: Record<string, string> = {
  get: 'bg-emerald-100 text-emerald-700 border-emerald-300',
  post: 'bg-blue-100 text-blue-700 border-blue-300',
  patch: 'bg-amber-100 text-amber-700 border-amber-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
}

const methodLabels: Record<string, string> = {
  get: 'GET', post: 'POST', patch: 'PATCH', delete: 'DELETE', put: 'PUT',
}

export function SwaggerUI() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState<string>('all')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/docs')
      .then(r => r.json())
      .then(data => { setSpec(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-8 text-slate-500">Nalagam API dokumentacijo...</div>
  if (!spec) return <div className="text-center py-8 text-red-500">Napaka pri nalaganju</div>

  const togglePath = (key: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const filteredPaths = Object.entries(spec.paths).filter(([path, methods]) => {
    const matchesSearch = search === '' || path.includes(search.toLowerCase()) ||
      Object.values(methods).some(m => m.summary?.toLowerCase().includes(search.toLowerCase()))
    const matchesTag = activeTag === 'all' ||
      Object.values(methods).some(m => m.tags?.includes(activeTag))
    return matchesSearch && matchesTag
  })

  const pathsByTag: Record<string, Array<[string, string, any]>> = {}
  for (const [path, methods] of filteredPaths) {
    for (const method of Object.keys(methods)) {
      const tag = methods[method].tags?.[0] || 'Other'
      if (!pathsByTag[tag]) pathsByTag[tag] = []
      pathsByTag[tag].push([path, method, methods[method]])
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <FileText className="size-4 text-emerald-600" />
          API Dokumentacija (OpenAPI 3.0)
        </h2>
        <p className="text-xs text-slate-500">{spec.info.title} v{spec.info.version} — {Object.keys(spec.paths).length} endpointov</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Iskanje endpointov..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      <div className="flex gap-1 flex-wrap">
        <Button size="sm" variant={activeTag === 'all' ? 'default' : 'outline'} onClick={() => setActiveTag('all')} className="h-7 text-xs">
          Vsi ({Object.keys(spec.paths).length})
        </Button>
        {spec.tags.map(tag => (
          <Button key={tag.name} size="sm" variant={activeTag === tag.name ? 'default' : 'outline'} onClick={() => setActiveTag(tag.name)} className="h-7 text-xs">
            <Tag className="size-3 mr-1" /> {tag.name}
          </Button>
        ))}
      </div>

      <ScrollArea className="max-h-[70vh]">
        <div className="space-y-2">
          {Object.entries(pathsByTag).map(([tag, paths]) => {
            const tagInfo = spec.tags.find(t => t.name === tag)
            return (
              <div key={tag}>
                <div className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2 sticky top-0 bg-white py-1 z-10">
                  <Box className="size-3.5 text-emerald-500" />
                  {tag}
                  {tagInfo && <span className="text-xs text-slate-400 font-normal">— {tagInfo.description}</span>}
                </div>
                <div className="space-y-1">
                  {paths.map(([path, method, details], idx) => {
                    const pathKey = `${method.toUpperCase()} ${path}`
                    const isExpanded = expandedPaths.has(pathKey)
                    const isProtected = details.security?.some((s: any) => s.cookieAuth || s.bearerAuth)
                    return (
                      <div key={`${pathKey}-${idx}`} className="border rounded-lg overflow-hidden">
                        <button onClick={() => togglePath(pathKey)} className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 text-left">
                          <Badge variant="outline" className={`text-[10px] font-mono font-bold shrink-0 ${methodColors[method] || 'bg-slate-100'}`}>
                            {methodLabels[method] || method.toUpperCase()}
                          </Badge>
                          <span className="font-mono text-xs text-slate-700 flex-1 truncate">{path}</span>
                          <span className="text-xs text-slate-500 hidden sm:block truncate">{details.summary}</span>
                          {isProtected ? <Lock className="size-3 text-amber-500 shrink-0" /> : <Unlock className="size-3 text-emerald-500 shrink-0" />}
                          {isExpanded ? <ChevronDown className="size-4 text-slate-400 shrink-0" /> : <ChevronRight className="size-4 text-slate-400 shrink-0" />}
                        </button>
                        {isExpanded && (
                          <div className="p-3 bg-slate-50 border-t space-y-2 text-xs">
                            <div className="font-medium">{details.summary}</div>
                            {details.tags && (
                              <div className="flex gap-1 flex-wrap">
                                {details.tags.map((t: string) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                              </div>
                            )}
                            {details.parameters && details.parameters.length > 0 && (
                              <div>
                                <div className="font-medium text-slate-600 mb-1">Parametri:</div>
                                {details.parameters.map((p: any, i: number) => (
                                  <div key={i} className="flex gap-2">
                                    <span className="font-mono text-emerald-600">{p.name}</span>
                                    <span className="text-slate-400">({p.in})</span>
                                    <span className="text-slate-600">{p.schema?.type || 'string'}</span>
                                    {p.required && <span className="text-red-500">*obvezno</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {details.responses && (
                              <div>
                                <div className="font-medium text-slate-600 mb-1">Odgovori:</div>
                                {Object.entries(details.responses).map(([code, resp]: any) => (
                                  <div key={code} className="flex gap-2">
                                    <Badge variant="outline" className={`text-[10px] ${code === '200' ? 'bg-emerald-50 text-emerald-700' : code === '429' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{code}</Badge>
                                    <span className="text-slate-600">{resp.description}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {isProtected && (
                              <div className="flex items-center gap-1 text-amber-600">
                                <Lock className="size-3" /> Zahteva avtentikacijo (cookie ali Bearer token)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
