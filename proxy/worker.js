// Proxy opcional para Groq en Cloudflare Workers (plan gratuito).
// Sirve para no exponer la clave en el navegador y para evitar bloqueos de CORS.
// 1) npm create cloudflare@latest  →  pega este archivo como src/index.js
// 2) npx wrangler secret put GROQ_API_KEY   (pega tu clave)
// 3) npx wrangler deploy  →  copia la URL (https://<nombre>.<tu-cuenta>.workers.dev)
// 4) En Escucha: Perfil → Inteligencia artificial → Proxy, pega esa URL.
const ALLOWED_ORIGINS = ['https://thiagoicochea.github.io', 'http://localhost:5173']
const ALLOWED_PATHS = ['/chat/completions', '/audio/transcriptions']

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    const path = new URL(request.url).pathname
    if (request.method !== 'POST' || !ALLOWED_PATHS.includes(path) || !ALLOWED_ORIGINS.includes(origin)) {
      return new Response('No permitido', { status: 403, headers: cors })
    }
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${env.GROQ_API_KEY}`)
    headers.delete('Origin')
    const res = await fetch(`https://api.groq.com/openai/v1${path}`, { method: 'POST', headers, body: request.body })
    const out = new Response(res.body, res)
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v))
    return out
  }
}
