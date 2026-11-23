// Cuentas locales: usuario + contraseña con PBKDF2 (Web Crypto). Sin servidor: las cuentas viven en este navegador.
// La recuperación usa un código que se muestra una sola vez al registrarse (no hay correo que enviar sin backend).
import { useSyncExternalStore } from 'react'
import { dataKey, getSession, snapshot, switchSession, defaultState, setState } from './store'

const ACCOUNTS_KEY = 'escucha.accounts'
const GRACE_DAYS = 30
const listeners = new Set()

function readAccounts() {
  try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]') } catch { return [] }
}
let accounts = readAccounts()
function save() {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)) } catch { /* sin almacenamiento */ }
  listeners.forEach((l) => l())
}
const subscribe = (l) => (listeners.add(l), () => listeners.delete(l))

const enc = new TextEncoder()
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const randHex = (n = 16) => toHex(crypto.getRandomValues(new Uint8Array(n)))

async function hash(secret, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 150000, hash: 'SHA-256' }, key, 256)
  return toHex(bits)
}

const normUser = (u) => u.trim().toLowerCase()
export const findAccount = (username) => accounts.find((a) => a.username === normUser(username))
export const currentAccount = () => accounts.find((a) => a.id === getSession()) || null

export function useAccount() {
  const sess = useSyncExternalStore(subscribe, getSession, getSession)
  const list = useSyncExternalStore(subscribe, () => accounts, () => accounts)
  return list.find((a) => a.id === sess) || null
}

function recoveryCode() {
  const raw = randHex(8).toUpperCase()
  return raw.match(/.{4}/g).join('-')
}

export function validatePassword(p) {
  if (p.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return 'Usa letras y al menos un número.'
  return ''
}

export async function register({ username, password, carryData = true }) {
  const u = normUser(username)
  if (!/^[a-z0-9_.ñ-]{3,24}$/.test(u)) throw new Error('El usuario debe tener de 3 a 24 letras, números, punto o guion, sin espacios.')
  if (findAccount(u)) throw new Error('Ese usuario ya existe en este dispositivo. Elige otro o inicia sesión.')
  const err = validatePassword(password)
  if (err) throw new Error(err)
  const salt = randHex()
  const code = recoveryCode()
  const rsalt = randHex()
  const acc = {
    id: `u_${randHex(6)}`,
    username: u,
    display: username.trim(),
    salt,
    hash: await hash(password, salt),
    rsalt,
    rhash: await hash(code, rsalt),
    createdAt: new Date().toISOString(),
    status: 'active'
  }
  accounts = [...accounts, acc]
  save()
  const prev = snapshot()
  const carry = carryData
    ? { ...prev, onboarded: true, alias: prev.alias || acc.display }
    : { ...defaultState(), onboarded: true, coachDone: prev.coachDone, alias: acc.display, groqKey: prev.groqKey }
  switchSession(acc.id, { carry })
  if (carryData) {
    // Los datos del modo invitado pasan a la cuenta y el invitado queda vacío
    try { localStorage.removeItem(dataKey('guest')) } catch { /* nada */ }
  }
  save()
  return { account: acc, recoveryCode: code }
}

export async function login({ username, password }) {
  const acc = findAccount(username)
  if (!acc) throw new Error('No encontramos ese usuario en este dispositivo.')
  if ((await hash(password, acc.salt)) !== acc.hash) throw new Error('La contraseña no es correcta.')
  const wasPending = acc.status === 'pending_delete'
  const wasDeactivated = acc.status === 'deactivated'
  if (wasDeactivated) updateAccount(acc.id, { status: 'active' })
  switchSession(acc.id)
  save()
  return { account: acc, pendingDelete: wasPending ? acc.deleteAt : null, reactivated: wasDeactivated }
}

export function logout() {
  switchSession('guest')
  setState({ onboarded: true, coachDone: true })
  save()
}

export async function recover({ username, code, newPassword }) {
  const acc = findAccount(username)
  if (!acc) throw new Error('No encontramos ese usuario en este dispositivo.')
  if ((await hash(code.trim().toUpperCase(), acc.rsalt)) !== acc.rhash) throw new Error('El código de recuperación no coincide.')
  const err = validatePassword(newPassword)
  if (err) throw new Error(err)
  const salt = randHex()
  updateAccount(acc.id, { salt, hash: await hash(newPassword, salt) })
}

export async function checkPassword(id, password) {
  const acc = accounts.find((a) => a.id === id)
  return !!acc && (await hash(password, acc.salt)) === acc.hash
}

function updateAccount(id, patch) {
  accounts = accounts.map((a) => (a.id === id ? { ...a, ...patch } : a))
  save()
}

export function deactivate(id) {
  updateAccount(id, { status: 'deactivated' })
  logout()
}

export function requestDeletion(id, reason = '') {
  const deleteAt = new Date(Date.now() + GRACE_DAYS * 864e5).toISOString()
  const requestId = `ESC-${randHex(4).toUpperCase()}`
  updateAccount(id, { status: 'pending_delete', deleteAt, requestId, reason })
  const acc = accounts.find((a) => a.id === id)
  logout()
  return { deleteAt, requestId, username: acc.username }
}

export function cancelDeletion(id) {
  updateAccount(id, { status: 'active', deleteAt: null, requestId: null })
}

// Al abrir la app: borra definitivamente las cuentas cuyo periodo de gracia terminó
export function purgeExpired() {
  const now = Date.now()
  const expired = accounts.filter((a) => a.status === 'pending_delete' && new Date(a.deleteAt).getTime() <= now)
  if (!expired.length) return
  expired.forEach((a) => { try { localStorage.removeItem(dataKey(a.id)) } catch { /* nada */ } })
  accounts = accounts.filter((a) => !expired.includes(a))
  if (expired.some((a) => a.id === getSession())) switchSession('guest')
  save()
}

export function exportData() {
  const acc = currentAccount()
  const { groqKey, ...data } = snapshot() // eslint-disable-line no-unused-vars
  return JSON.stringify({ exportadoEl: new Date().toISOString(), usuario: acc?.username || 'invitado', datos: data }, null, 2)
}

export function download(name, text, type = 'text/plain') {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const GRACE = GRACE_DAYS
