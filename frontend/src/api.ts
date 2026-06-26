// Talks to the backend through nginx's /api proxy (and Vite's dev proxy locally).
const BASE = '/api'

async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
  if (res.status === 204) return null
  return res.json()
}

export type ApiBlock = {
  id: string; type: string; position: number
  parentBlockId: string | null; contentJson: string | null
}
export type ApiItem = {
  id: string; type: string; title: string
  currentVersion: number; fieldsJson: string | null; blocks: ApiBlock[]
}
export type BlockInput = {
  type: string; position: number
  contentJson?: string | null; parentBlockId?: string | null
}

export const api = {
  listSpaces: (): Promise<any[]> => req('/spaces'),
  createSpace: (body: { name: string; icon?: string; description?: string }): Promise<any> =>
    req('/spaces', { method: 'POST', body: JSON.stringify(body) }),
  listItems: (spaceId: string): Promise<any[]> => req(`/spaces/${spaceId}/items`),
  createItem: (
    spaceId: string,
    body: { title: string; type?: string; fieldsJson?: string; blocks?: BlockInput[] },
  ): Promise<any> => req(`/spaces/${spaceId}/items`, { method: 'POST', body: JSON.stringify(body) }),
  getItem: (itemId: string): Promise<ApiItem> => req(`/items/${itemId}`),
  replaceBlocks: (itemId: string, blocks: BlockInput[]): Promise<any> =>
    req(`/items/${itemId}/blocks`, { method: 'PUT', body: JSON.stringify({ blocks }) }),
}
