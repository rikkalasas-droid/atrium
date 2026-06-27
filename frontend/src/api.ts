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
  updateItem: (itemId: string, body: { title?: string; fieldsJson?: string }): Promise<any> =>
    req(`/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteItem: (itemId: string): Promise<null> =>
    req(`/items/${itemId}`, { method: 'DELETE' }),
  replaceBlocks: (itemId: string, blocks: BlockInput[]): Promise<any> =>
    req(`/items/${itemId}/blocks`, { method: 'PUT', body: JSON.stringify({ blocks }) }),
  importUrl: (url: string): Promise<{ finalUrl: string; status: number; html: string }> =>
    req('/import/url', { method: 'POST', body: JSON.stringify({ url }) }),

  // server-mediated file upload (works even when the cloud endpoint isn't browser-reachable)
  uploadFile: async (file: File, opts?: { itemId?: string; blockId?: string }):
    Promise<{ id: string; fileName: string; size: number; contentType: string }> => {
    const fd = new FormData()
    fd.append('file', file)
    if (opts?.itemId) fd.append('itemId', opts.itemId)
    if (opts?.blockId) fd.append('blockId', opts.blockId)
    const res = await fetch(BASE + '/files/direct', { method: 'POST', body: fd })
    if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`)
    return res.json()
  },
  deleteFile: (id: string): Promise<null> => req(`/files/${id}`, { method: 'DELETE' }),
  fileRawUrl: (id: string) => `${BASE}/files/${id}/raw`,
}
