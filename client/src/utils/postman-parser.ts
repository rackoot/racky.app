/**
 * Postman Collection Parser
 *
 * Parses Postman Collection v2.1.0 format and extracts relevant information
 * for rendering API documentation
 */

export interface PostmanVariable {
  key: string
  value: string
  type: string
}

export interface PostmanRequest {
  name: string
  method: string
  url: string | { raw: string; protocol?: string; host?: string[]; port?: string; path?: string[] }
  description?: string
  header?: Array<{ key: string; value: string; type?: string }>
  body?: {
    mode: string
    raw?: string
    urlencoded?: Array<{ key: string; value: string }>
    formdata?: Array<{ key: string; value: string; type?: string }>
  }
  auth?: {
    type: string
    [key: string]: any
  }
}

export interface PostmanItem {
  name: string
  description?: string
  request?: PostmanRequest
  response?: any[]
  item?: PostmanItem[] // Nested items (folders)
}

export interface PostmanCollection {
  info: {
    name: string
    description?: string
    version?: string
    schema: string
  }
  auth?: {
    type: string
    [key: string]: any
  }
  variable?: PostmanVariable[]
  item: PostmanItem[]
}

export interface ParsedEndpoint {
  id: string
  name: string
  method: string
  url: string
  description?: string
  headers: Array<{ key: string; value: string }>
  body?: string
  bodyMode?: string
  requiresAuth: boolean
  folder: string
}

export interface ParsedFolder {
  name: string
  description?: string
  endpoints: ParsedEndpoint[]
}

export interface ParsedCollection {
  name: string
  description?: string
  version?: string
  variables: PostmanVariable[]
  folders: ParsedFolder[]
  authType?: string
}

/**
 * Parse URL object or string to a readable format
 */
function parseUrl(url: PostmanRequest['url']): string {
  if (typeof url === 'string') {
    return url
  }

  if (url.raw) {
    return url.raw
  }

  // Construct URL from parts
  const protocol = url.protocol || 'http'
  const host = url.host ? url.host.join('.') : 'localhost'
  const port = url.port ? `:${url.port}` : ''
  const path = url.path ? '/' + url.path.join('/') : ''

  return `${protocol}://${host}${port}${path}`
}

/**
 * Generate unique ID for endpoint
 */
function generateId(folderName: string, endpointName: string, method: string): string {
  return `${folderName}-${endpointName}-${method}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

/**
 * Extract endpoints from items (recursive for nested folders)
 */
function extractEndpoints(
  items: PostmanItem[],
  folderName: string = 'General',
  endpoints: ParsedEndpoint[] = []
): ParsedEndpoint[] {
  for (const item of items) {
    if (item.request) {
      // This is an endpoint
      const request = item.request
      const url = parseUrl(request.url)
      const headers = (request.header || []).map(h => ({
        key: h.key,
        value: h.value
      }))

      let body: string | undefined
      let bodyMode: string | undefined

      if (request.body) {
        bodyMode = request.body.mode
        if (request.body.mode === 'raw' && request.body.raw) {
          // Try to pretty-print JSON
          try {
            const parsed = JSON.parse(request.body.raw)
            body = JSON.stringify(parsed, null, 2)
          } catch {
            body = request.body.raw
          }
        } else if (request.body.mode === 'urlencoded') {
          body = request.body.urlencoded
            ?.map(item => `${item.key}=${item.value}`)
            .join('\n')
        } else if (request.body.mode === 'formdata') {
          body = request.body.formdata
            ?.map(item => `${item.key}: ${item.value}`)
            .join('\n')
        }
      }

      endpoints.push({
        id: generateId(folderName, item.name, request.method),
        name: item.name,
        method: request.method.toUpperCase(),
        url,
        description: item.description || request.description,
        headers,
        body,
        bodyMode,
        requiresAuth: request.auth?.type !== 'noauth',
        folder: folderName
      })
    } else if (item.item) {
      // This is a folder, recurse
      extractEndpoints(item.item, item.name, endpoints)
    }
  }

  return endpoints
}

/**
 * Parse Postman collection JSON into organized structure
 */
export function parsePostmanCollection(collection: PostmanCollection): ParsedCollection {
  const folders: ParsedFolder[] = []

  // Extract variables
  const variables = collection.variable || []

  // Process top-level items
  for (const item of collection.item) {
    if (item.item) {
      // This is a folder
      const endpoints = extractEndpoints(item.item, item.name)
      folders.push({
        name: item.name,
        description: item.description,
        endpoints
      })
    } else if (item.request) {
      // Top-level endpoint (no folder)
      const endpoints = extractEndpoints([item], 'General')
      const existingFolder = folders.find(f => f.name === 'General')
      if (existingFolder) {
        existingFolder.endpoints.push(...endpoints)
      } else {
        folders.push({
          name: 'General',
          endpoints
        })
      }
    }
  }

  return {
    name: collection.info.name,
    description: collection.info.description,
    version: collection.info.version,
    variables,
    folders,
    authType: collection.auth?.type
  }
}

/**
 * Get method badge color
 */
export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    PUT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
    PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  }

  return colors[method.toUpperCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
}

/**
 * Format URL with variable placeholders highlighted
 */
export function formatUrl(url: string): { parts: Array<{ text: string; isVariable: boolean }> } {
  const parts: Array<{ text: string; isVariable: boolean }> = []
  const regex = /(\{\{[^}]+\}\})/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(url)) !== null) {
    // Add text before variable
    if (match.index > lastIndex) {
      parts.push({
        text: url.substring(lastIndex, match.index),
        isVariable: false
      })
    }

    // Add variable
    parts.push({
      text: match[1],
      isVariable: true
    })

    lastIndex = match.index + match[1].length
  }

  // Add remaining text
  if (lastIndex < url.length) {
    parts.push({
      text: url.substring(lastIndex),
      isVariable: false
    })
  }

  return { parts }
}
