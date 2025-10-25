import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Search, Copy, Check, Lock, Unlock } from 'lucide-react'
import {
  parsePostmanCollection,
  getMethodColor,
  formatUrl,
  type PostmanCollection,
  type ParsedCollection,
  type ParsedEndpoint,
} from '@/utils/postman-parser'

export function ApiDocsPage() {
  const [collection, setCollection] = useState<ParsedCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    loadPostmanCollection()
  }, [])

  const loadPostmanCollection = async () => {
    try {
      setLoading(true)
      const response = await fetch('/postman_collection.json')
      if (!response.ok) {
        throw new Error('Failed to load Postman collection')
      }
      const data: PostmanCollection = await response.json()
      const parsed = parsePostmanCollection(data)
      setCollection(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API documentation')
    } finally {
      setLoading(false)
    }
  }

  // Filter endpoints based on search query
  const filteredFolders = useMemo(() => {
    if (!collection || !searchQuery) return collection?.folders || []

    const query = searchQuery.toLowerCase()
    return collection.folders
      .map(folder => ({
        ...folder,
        endpoints: folder.endpoints.filter(
          endpoint =>
            endpoint.name.toLowerCase().includes(query) ||
            endpoint.method.toLowerCase().includes(query) ||
            endpoint.url.toLowerCase().includes(query) ||
            endpoint.description?.toLowerCase().includes(query)
        ),
      }))
      .filter(folder => folder.endpoints.length > 0)
  }, [collection, searchQuery])

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground">Loading API documentation...</p>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || 'Failed to load API documentation'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadPostmanCollection} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <BookOpen className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">{collection.name}</h1>
          {collection.version && (
            <Badge variant="secondary" className="text-xs">
              v{collection.version}
            </Badge>
          )}
        </div>
        {collection.description && (
          <p className="text-muted-foreground mt-2">{collection.description}</p>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endpoints by name, method, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Collection Variables */}
      {collection.variables.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Collection Variables</CardTitle>
            <CardDescription>
              Variables used across all endpoints in this collection
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {collection.variables.map((variable) => (
                <div
                  key={variable.key}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <code className="text-sm font-mono text-primary">
                      {'{{' + variable.key + '}}'}
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">{variable.value || '(empty)'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(variable.value, `var-${variable.key}`)}
                  >
                    {copiedId === `var-${variable.key}` ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Endpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Endpoints</CardTitle>
          <CardDescription>
            {searchQuery
              ? `Found ${filteredFolders.reduce((acc, f) => acc + f.endpoints.length, 0)} endpoints`
              : `${collection.folders.reduce((acc, f) => acc + f.endpoints.length, 0)} total endpoints`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {filteredFolders.map((folder) => (
              <AccordionItem key={folder.name} value={folder.name}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{folder.name}</span>
                    <Badge variant="secondary">{folder.endpoints.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {folder.endpoints.map((endpoint) => (
                      <EndpointCard
                        key={endpoint.id}
                        endpoint={endpoint}
                        copiedId={copiedId}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {filteredFolders.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No endpoints match your search</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface EndpointCardProps {
  endpoint: ParsedEndpoint
  copiedId: string | null
  onCopy: (text: string, id: string) => void
}

function EndpointCard({ endpoint, copiedId, onCopy }: EndpointCardProps) {
  const urlParts = formatUrl(endpoint.url)

  return (
    <Card className="border-l-4" style={{ borderLeftColor: getMethodBorderColor(endpoint.method) }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className={getMethodColor(endpoint.method)}>{endpoint.method}</Badge>
              {endpoint.requiresAuth ? (
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Auth Required
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Unlock className="h-3 w-3" />
                  No Auth
                </Badge>
              )}
            </div>
            <h4 className="font-semibold text-base mb-2">{endpoint.name}</h4>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-sm font-mono bg-muted px-2 py-1 rounded break-all">
                {urlParts.parts.map((part, index) => (
                  <span
                    key={index}
                    className={part.isVariable ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}
                  >
                    {part.text}
                  </span>
                ))}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCopy(endpoint.url, `url-${endpoint.id}`)}
                className="h-7"
              >
                {copiedId === `url-${endpoint.id}` ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            {endpoint.description && (
              <p className="text-sm text-muted-foreground mt-3">{endpoint.description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      {(endpoint.headers.length > 0 || endpoint.body) && (
        <CardContent className="pt-0">
          <Tabs defaultValue={endpoint.body ? 'body' : 'headers'} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${endpoint.body ? 2 : 1}, 1fr)` }}>
              {endpoint.body && <TabsTrigger value="body">Request Body</TabsTrigger>}
              <TabsTrigger value="headers">Headers ({endpoint.headers.length})</TabsTrigger>
            </TabsList>

            {endpoint.body && (
              <TabsContent value="body">
                <ScrollArea className="h-[300px] w-full rounded-md border">
                  <pre className="p-4 text-sm">
                    <code>{endpoint.body}</code>
                  </pre>
                </ScrollArea>
                <div className="flex justify-end mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCopy(endpoint.body || '', `body-${endpoint.id}`)}
                  >
                    {copiedId === `body-${endpoint.id}` ? (
                      <>
                        <Check className="h-3 w-3 mr-2 text-green-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-2" />
                        Copy Body
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            )}

            <TabsContent value="headers">
              {endpoint.headers.length > 0 ? (
                <div className="space-y-2">
                  {endpoint.headers.map((header, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <code className="font-semibold text-primary">{header.key}</code>
                        <p className="text-muted-foreground truncate mt-1">{header.value}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCopy(header.value, `header-${endpoint.id}-${index}`)}
                      >
                        {copiedId === `header-${endpoint.id}-${index}` ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">No headers defined</p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  )
}

function getMethodBorderColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#3b82f6',
    POST: '#22c55e',
    PUT: '#f97316',
    PATCH: '#eab308',
    DELETE: '#ef4444',
  }
  return colors[method.toUpperCase()] || '#6b7280'
}
