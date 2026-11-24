// Cuerpo y cara de los personajes con geometría propia (three.js): silueta torneada, extremidades con
// articulaciones, manos con pulgar, mandíbula modelada, párpados que parpadean, labios y respiración.
// El pelo y los accesorios se siguen agregando como entidades A-Frame sobre esta base.
import { normalizeAvatar } from './avatars'
import { threeTex } from './textures'

export function registerAvatar(A) {
  if (A.components['avatar-body']) return
  const THREE = A.THREE
  const V2 = (x, y) => new THREE.Vector2(x, y)
  const mats = {}
  // Material con textura procedural opcional: tex = [clave, repetición, intensidad del relieve]
  const mat = (color, opts = {}, tex = null) => {
    const k = color + JSON.stringify(opts) + (tex ? tex.join() : '')
    if (!mats[k]) {
      const extra = {}
      if (tex) {
        const [key, rep = 1, ns = 0.6] = tex
        extra.map = threeTex(THREE, key, rep)
        extra.normalMap = threeTex(THREE, key, rep, true)
        extra.normalScale = new THREE.Vector2(ns, ns)
      }
      mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, ...extra, ...opts })
    }
    return mats[k]
  }
  const skinMat = (color, rough = 0.58) => mat(color, { roughness: rough, emissive: new THREE.Color(color).multiplyScalar(0.06) }, ['skin', 2, 0.35])
  const TOP_TEX = { polo: 'fabric', camisa: 'fabric', vestido: 'fabric', casaca: 'leather', poleron: 'knit', poncho: 'knit' }
  const cloth = (color, kind = 'fabric') => mat(color, { roughness: kind === 'leather' ? 0.55 : 0.92 }, [kind, kind === 'knit' ? 3 : 4, kind === 'knit' ? 1 : 0.7])
  const shade = (hex, f) => {
    const c = new THREE.Color(hex)
    c.multiplyScalar(f)
    return `#${c.getHexString()}`
  }
  const capsule = (r, len, m, seg = 12) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, seg), m)
  const sphere = (r, m, w = 24, h = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, w, h), m)
  const lathe = (pts, m, flat = 0.74) => {
    // Los puntos deben ir de abajo hacia arriba para que las caras miren hacia afuera
    const ordered = pts[0][1] > pts[pts.length - 1][1] ? [...pts].reverse() : pts
    const g = new THREE.LatheGeometry(ordered.map(([r, y]) => V2(r, y)), 40)
    g.scale(1, 1, flat)
    g.computeVertexNormals()
    return new THREE.Mesh(g, m)
  }
  // Une un cilindro-cápsula entre dos puntos (para brazos y piernas)
  // Extremidad que se afina (muslo → rodilla, brazo → muñeca) con articulaciones redondeadas
  const limb = (a, b, r, m, r2 = r * 0.8) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    const grp = new THREE.Group()
    const geo = new THREE.CylinderGeometry(r2, r, len, 20, 6, true)
    // ligera curva muscular a lo largo
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const t = p.getY(i) / len + 0.5
      const k = 1 + Math.sin(t * Math.PI) * 0.1 * (t < 0.6 ? 1 : 0.7)
      p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k)
    }
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, m)
    mesh.position.copy(a).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    grp.add(mesh)
    const j1 = sphere(r, m, 16, 12); j1.position.copy(a); grp.add(j1)
    const j2 = sphere(r2, m, 16, 12); j2.position.copy(b); grp.add(j2)
    return grp
  }

  A.registerComponent('avatar-body', {
    schema: { type: 'string' },
    init() { this.build() },
    update(old) { if (old !== undefined && old !== this.data) this.build() },
    build() {
      let a
      try { a = normalizeAvatar(JSON.parse(this.data || '{}')) } catch { a = normalizeAvatar({}) }
      const g = new THREE.Group()
      const woman = a.body === 'mujer'
      const bx = { delgado: 0.88, medio: 1, robusto: 1.17 }[a.build]
      const skin = skinMat(a.skin)
      const top = cloth(a.outfit, TOP_TEX[a.top] || 'fabric')
      const pants = cloth(a.pants, 'denim')
      const shoes = mat(a.shoes, { roughness: 0.5 }, ['leather', 2, 0.5])
      const dress = a.top === 'vestido'
      const longSleeve = ['camisa', 'casaca', 'poleron'].includes(a.top)
      const W = (r) => r * bx

      // Torso: caderas → cintura → pecho → hombros (silueta distinta para mujer y hombre)
      const chest = woman ? 0.165 : 0.185
      const waist = woman ? 0.128 : 0.155
      const hips = woman ? 0.168 : 0.158
      const shoulders = woman ? 0.18 : 0.215
      if (!dress) {
        g.add(lathe([[0.001, 0.6], [W(hips * 0.9), 0.61], [W(hips + 0.006), 0.68], [W(waist + 0.01), 0.8]], pants))
      }
      const torsoPts = [[W(waist), 0.76], [W(waist), 0.86], [W((waist + chest) / 2), 0.96], [W(chest), 1.04], [W(shoulders), 1.13], [W(shoulders * 0.75), 1.19], [0.07, 1.22], [0.001, 1.225]]
      const torso = lathe(torsoPts, top)
      this.torso = torso
      g.add(torso)
      if (dress) g.add(lathe([[W(waist), 0.86], [W(waist + 0.04), 0.78], [W(0.24), 0.62], [W(0.3), 0.46], [0.001, 0.459]], top, 0.85))
      if (a.top === 'poncho') {
        const cape = lathe([[0.075, 1.24], [W(0.22), 1.14], [W(0.29), 1.0], [W(0.33), 0.8], [W(0.325), 0.79]], top, 0.8)
        g.add(cape)
        ;[['#F4F1EA', 0.84], ['#E0A43A', 0.88], [shade(a.outfit, 0.6), 0.92]].forEach(([c, y]) => {
          const r = W(0.33 - ((y - 0.8) / 0.2) * 0.04)
          g.add(lathe([[r + 0.004, y], [r - 0.003, y + 0.025]], cloth(c, 'knit'), 0.82))
        })
      }
      // Cuello
      const neck = capsule(woman ? 0.045 : 0.054, 0.1, skin)
      neck.position.set(0, 1.3, 0.008)
      g.add(neck)

      // Brazos con codo, antebrazo y mano con pulgar
      this.arms = []
      ;[-1, 1].forEach((sd) => {
        const arm = new THREE.Group()
        const sx = sd * W(shoulders - 0.02)
        arm.position.set(sx, 1.15, 0)
        const elbow = new THREE.Vector3(sd * 0.05, -0.27, 0.01)
        const wrist = new THREE.Vector3(sd * 0.065, -0.52, -0.05)
        const sleeveTop = a.top === 'poncho' ? skin : top
        if (a.top !== 'poncho') arm.add(sphere(W(woman ? 0.05 : 0.058), sleeveTop))
        arm.add(limb(new THREE.Vector3(0, 0, 0), elbow, W(woman ? 0.046 : 0.054), sleeveTop, W(woman ? 0.036 : 0.042)))
        arm.add(limb(elbow, wrist, W(woman ? 0.036 : 0.042), longSleeve ? top : skin, woman ? 0.026 : 0.03))
        if (longSleeve) {
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(W(0.043), 0.008, 8, 20), cloth(shade(a.outfit, 0.75), 'knit'))
          cuff.position.copy(wrist).lerp(elbow, 0.12)
          cuff.rotation.x = Math.PI / 2
          arm.add(cuff)
        }
        const hand = new THREE.Group()
        hand.position.copy(wrist).add(new THREE.Vector3(0, -0.055, -0.005))
        const palm = sphere(0.036, skin)
        palm.scale.set(0.85, 1.15, 0.5)
        hand.add(palm)
        // cuatro dedos ligeramente curvados
        for (let f = 0; f < 4; f++) {
          const fx = (f - 1.5) * 0.015
          const fl = [0.036, 0.042, 0.04, 0.032][f]
          const fin = capsule(0.0075, fl, skin, 8)
          fin.position.set(fx * sd * -1, -0.05 - fl * 0.3, -0.004)
          fin.rotation.x = 0.18
          hand.add(fin)
        }
        const thumb = capsule(0.013, 0.03, skin)
        thumb.position.set(-sd * 0.032, 0.012, -0.018)
        thumb.rotation.z = sd * 0.6
        hand.add(thumb)
        arm.add(hand)
        arm.userData.side = sd
        this.arms.push(arm)
        g.add(arm)
      })

      // Piernas con rodilla y zapatillas redondeadas
      ;[-1, 1].forEach((sd) => {
        const hip = new THREE.Vector3(sd * W(0.085), 0.66, 0)
        const knee = new THREE.Vector3(sd * W(0.082), 0.36, -0.01)
        const ankle = new THREE.Vector3(sd * W(0.078), 0.09, 0)
        const legM = dress ? skin : pants
        g.add(limb(hip, knee, W(0.075), legM, W(0.052)))
        g.add(limb(knee, ankle, W(0.054), legM, W(0.036)))
        const shoe = capsule(0.048, 0.11, shoes)
        shoe.rotation.x = Math.PI / 2
        shoe.position.set(ankle.x, 0.05, -0.04)
        shoe.scale.set(1.05, 1, 0.8)
        g.add(shoe)
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.2), mat('#F4F4F4'))
        sole.position.set(ankle.x, 0.01, -0.04)
        g.add(sole)
      })
      g.traverse((o) => { if (o.isMesh) { o.castShadow = false } })
      const prev = this.el.getObject3D('body')
      if (prev) this.el.removeObject3D('body')
      this.el.setObject3D('body', g)
      this.t0 = Math.random() * 10
    },
    setTalking(on) { this.talking = on },
    tick(t) {
      if (!this.torso) return
      const s = (t / 1000 + this.t0)
      // respiración, balanceo del peso y brazos; al hablar, gesticula con las manos
      const br = 1 + Math.sin(s * 1.4) * 0.012
      this.torso.scale.set(br, 1 + Math.sin(s * 1.4) * 0.006, br)
      const g = this.el.getObject3D('body')
      if (g) g.rotation.z = Math.sin(s * 0.45) * 0.012
      this.talkAmt = (this.talkAmt || 0) + ((this.talking ? 1 : 0) - (this.talkAmt || 0)) * 0.08
      this.arms?.forEach((arm) => {
        const sd = arm.userData.side
        const gest = this.talkAmt * (0.5 + Math.sin(s * (sd > 0 ? 3.1 : 2.6)) * 0.25)
        arm.rotation.z = sd * (0.04 + Math.sin(s * 0.9) * 0.025 + gest * 0.12)
        arm.rotation.x = Math.sin(s * 0.7 + sd) * 0.03 - gest * 0.9
      })
    },
    remove() { this.el.removeObject3D('body') }
  })

  // Iris con fibras radiales, anillo oscuro y reflejo (canvas pequeño por color de ojos)
  const irisCache = {}
  const irisMat = (color) => {
    if (irisCache[color]) return irisCache[color]
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const x = c.getContext('2d')
    x.fillStyle = color
    x.fillRect(0, 0, 128, 128)
    // SphereGeometry: v=0 arriba; la pupila mira a -z, que en la textura cae en u≈0.25
    for (let i = 0; i < 260; i++) {
      const u = Math.random() * 128
      x.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.22)'
      x.lineWidth = 0.6 + Math.random()
      x.beginPath(); x.moveTo(u, 0); x.lineTo(u + (Math.random() - 0.5) * 6, 128); x.stroke()
    }
    const grad = x.createLinearGradient(0, 0, 0, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.45)'); grad.addColorStop(0.5, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.45)')
    x.fillStyle = grad
    x.fillRect(0, 0, 128, 128)
    const tex = new THREE.CanvasTexture(c)
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
    return (irisCache[color] = new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: tex, roughness: 0.12 }))
  }

  // ---------- Pelo con geometría propia y textura de mechones ----------
  const HATS = ['gorra', 'chullo', 'sombrero']
  const smooth = (t) => t * t * (3 - 2 * t)
  // Casquete con línea de nacimiento: más alto en la frente, más bajo en la nuca
  const scalp = (r, front, back, bulk = 1) => {
    const g = new THREE.SphereGeometry(r, 56, 36, 0, Math.PI * 2, 0, (back * Math.PI) / 180)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i); const y = p.getY(i); const z = p.getZ(i)
      const az = Math.atan2(x, z) // 0 = nuca, ±π = frente
      const w = smooth((Math.cos(az) + 1) / 2)
      const lim = ((front + (back - front) * w) * Math.PI) / 180
      let phi = Math.acos(Math.max(-1, Math.min(1, y / r)))
      if (phi > lim) phi = lim
      const rr = r * (1 + (bulk - 1) * Math.sin(Math.min(phi, Math.PI / 2)))
      // la cabeza está estirada en altura (y × 1.1): el casquete la acompaña
      p.setXYZ(i, rr * Math.sin(phi) * Math.sin(az) * 1.02, rr * Math.cos(phi) * 1.13, rr * Math.sin(phi) * Math.cos(az) * 1.03)
    }
    g.computeVertexNormals()
    return g
  }
  // Melena: superficie que cae desde las sienes y la nuca, con mechones y puntas irregulares
  const curtain = (len, { span = 125, wave = 0.006, waveF = 14, flare = 0.05, top = 0.03, r0 = 0.198 } = {}) => {
    const cols = 64
    const rows = 28
    const pos = []
    const uv = []
    const idx = []
    const tipJit = Array.from({ length: cols + 1 }, (_, i) => 0.03 * Math.sin(i * 2.3) + 0.02 * Math.sin(i * 5.1))
    for (let j = 0; j <= rows; j++) {
      const t = j / rows
      for (let i = 0; i <= cols; i++) {
        const az = ((-span + (2 * span * i) / cols) * Math.PI) / 180
        const L = len + tipJit[i] * (Math.abs(az) < 1.2 ? 1 : 0.5)
        const y = top - t * L
        const r = r0 + flare * smooth(Math.min(1, t * 1.6)) - 0.02 * Math.pow(t, 3) + wave * Math.sin(az * waveF + t * 9) + (wave > 0.01 ? wave * Math.sin(t * 22 + az * 2) : 0)
        pos.push(r * Math.sin(az), y, r * Math.cos(az) * 0.98 + 0.01)
        uv.push(i / cols * 2, t)
      }
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  // Tubo que se adelgaza (cola de caballo, trenzas)
  const taperTube = (pts, r0, r1, m) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
    const g = new THREE.TubeGeometry(curve, 32, 1, 16, false)
    const p = g.attributes.position
    const uvA = g.attributes.uv
    const c = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      const u = uvA.getX(i)
      curve.getPointAt(Math.min(1, u), c)
      const r = r0 + (r1 - r0) * u
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * r, c.y + (p.getY(i) - c.y) * r, c.z + (p.getZ(i) - c.z) * r)
    }
    g.computeVertexNormals()
    return new THREE.Mesh(g, m)
  }

  A.registerComponent('avatar-hair', {
    schema: { type: 'string' },
    init() { this.build() },
    update(old) { if (old !== undefined && old !== this.data) this.build() },
    build() {
      let a
      try { a = normalizeAvatar(JSON.parse(this.data || '{}')) } catch { a = normalizeAvatar({}) }
      const g = new THREE.Group()
      const hat = a.accessories.some((k) => HATS.includes(k))
      const H = mat(a.hairColor, { roughness: 0.48, metalness: 0.04 }, ['hair', 2, 0.9])
      const C = mat(a.hairColor, { roughness: 0.8 }, ['curls', 2, 1.4])
      const add = (geo, m = H) => { const mesh = new THREE.Mesh(geo, m); g.add(mesh); return mesh }
      const cap = (front = 58, back = 104, bulk = 1.05, r = 0.198) => add(scalp(r, front, back, bulk))
      switch (a.hair) {
        case 'corto': cap(60, 100, 1.07); break
        case 'rapado': { const m = cap(64, 100, 1.0, 0.193); m.material = mat(a.hairColor, { roughness: 0.9, transparent: true, opacity: 0.85 }, ['hair', 4, 0.5]); break }
        case 'largo': cap(56, 104); add(curtain(0.56, { flare: 0.09 })); break
        case 'ondulado': cap(56, 104, 1.08); add(curtain(0.46, { wave: 0.016, waveF: 6, flare: 0.1 })); break
        case 'flequillo': {
          cap(50, 102, 1.06)
          const b = add(curtain(0.1, { span: 60, top: 0.16, r0: 0.205, flare: 0.012, wave: 0.004, waveF: 22 }))
          b.rotation.y = Math.PI
          break
        }
        case 'cola':
          cap(54, 96, 1.03)
          g.add(taperTube([[0, 0.1, 0.17], [0, 0.04, 0.26], [0, -0.12, 0.27], [0, -0.3, 0.24]], 0.05, 0.018, H))
          { const tie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20), mat('#E86F9A')); tie.position.set(0, 0.09, 0.2); tie.rotation.x = 0.9; g.add(tie) }
          break
        case 'recogido': {
          cap(54, 96, 1.03)
          const bun = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 24), H)
          bun.position.set(0, hat ? 0.02 : 0.15, hat ? 0.22 : 0.16)
          bun.scale.set(1, 0.85, 0.9)
          g.add(bun)
          break
        }
        case 'trenzas':
          cap(56, 100, 1.03)
          ;[-1, 1].forEach((sd) => {
            for (let k = 0; k < 9; k++) {
              const seg = new THREE.Mesh(new THREE.SphereGeometry(0.034 - k * 0.0015, 16, 12), H)
              seg.position.set(sd * (0.175 + k * 0.002), -0.06 - k * 0.05, 0.03 - k * 0.006)
              seg.scale.set(1, 1.35, 0.8)
              seg.rotation.z = (k % 2 ? 0.5 : -0.5)
              g.add(seg)
            }
            const tie = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat('#E86F9A'))
            tie.position.set(sd * 0.193, -0.52, -0.024)
            g.add(tie)
          })
          break
        case 'rizado': {
          const base = add(scalp(0.2, 56, 100, 1.08), C)
          base.scale.set(1, 1, 1)
          const n = hat ? 14 : 34
          for (let i = 0; i < n; i++) {
            // reparto en espiral sobre la parte alta y la nuca
            const t = (i + 0.5) / n
            const phi = Math.acos(1 - t * (hat ? 0.9 : 1.25))
            const az = i * 2.399
            if (Math.cos(az) < -0.55 && phi > 0.9) continue // no tapar la frente
            const r = 0.205
            const b = new THREE.Mesh(new THREE.SphereGeometry(0.048 + (i % 3) * 0.006, 16, 12), C)
            b.position.set(r * Math.sin(phi) * Math.sin(az), r * Math.cos(phi) + 0.01, r * Math.sin(phi) * Math.cos(az))
            g.add(b)
          }
          break
        }
        case 'afro': {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.26, 48, 32), mat(a.hairColor, { roughness: 1 }, ['curls', 4, 1.8]))
          m.position.set(0, hat ? 0.02 : 0.11, 0.1)
          m.scale.set(1, hat ? 0.7 : 0.95, 0.95)
          g.add(m)
          break
        }
        default: cap()
      }
      // Vello facial con la misma textura: barba que sigue la mandíbula y bigote curvo
      const F = mat(a.hairColor, { roughness: 0.9 }, ['hair', 3, 1.2])
      if (a.facial === 'barba' || a.facial === 'candado') {
        const wide = a.facial === 'barba'
        const geo = new THREE.SphereGeometry(0.196, 40, 20, Math.PI * (wide ? 1.05 : 1.33), Math.PI * (wide ? 0.9 : 0.34), Math.PI * (wide ? 0.62 : 0.66), Math.PI * 0.26)
        const p = geo.attributes.position
        for (let i = 0; i < p.count; i++) {
          // misma deformación de mandíbula que la cara (hombre) + un poco de volumen
          let x = p.getX(i); let y = p.getY(i); let z = p.getZ(i)
          const k = Math.pow(Math.max(0, -y) / 0.19, 2.4)
          x *= (1 - 0.12 * k) * 1.04; z = z * (1 - 0.06 * k) * 1.04 - 0.02 * k
          p.setXYZ(i, x, y * 1.1, z)
        }
        geo.computeVertexNormals()
        g.add(new THREE.Mesh(geo, F))
      }
      if (a.facial !== 'ninguno') {
        const mus = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.009, 8, 20, Math.PI), F)
        mus.position.set(0, -0.058, -0.19)
        mus.scale.set(1.25, 0.5, 1)
        g.add(mus)
      }
      const prev = this.el.getObject3D('hair')
      if (prev) this.el.removeObject3D('hair')
      this.el.setObject3D('hair', g)
    },
    remove() { this.el.removeObject3D('hair') }
  })

  A.registerComponent('avatar-face', {
    schema: { type: 'string' },
    init() { this.build() },
    update(old) { if (old !== undefined && old !== this.data) this.build() },
    build() {
      let a
      try { a = normalizeAvatar(JSON.parse(this.data || '{}')) } catch { a = normalizeAvatar({}) }
      const woman = a.body === 'mujer'
      const g = new THREE.Group()
      const skin = skinMat(a.skin, 0.52)
      // Cabeza con mandíbula más angosta y mentón suave
      const hg = new THREE.SphereGeometry(0.19, 48, 36)
      const p = hg.attributes.position
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i)
        let y = p.getY(i)
        let z = p.getZ(i)
        if (y < 0) {
          // mujer: mentón fino; hombre: mandíbula más ancha y cuadrada
          const k = Math.pow(-y / 0.19, woman ? 1.6 : 2.4)
          x *= 1 - (woman ? 0.24 : 0.12) * k
          z *= 1 - (woman ? 0.1 : 0.06) * k
          if (z < 0) z -= (woman ? 0.012 : 0.02) * k
        }
        if (!woman && z < -0.1 && y > 0.06 && y < 0.11) z -= 0.006 // arco de las cejas
        if (z < -0.12 && Math.abs(x) < 0.12 && y > -0.05 && y < 0.09) z *= 0.985 // frente/mejillas un poco más planas
        p.setXYZ(i, x, y * 1.1, z)
      }
      hg.computeVertexNormals()
      g.add(new THREE.Mesh(hg, skin))
      ;[-1, 1].forEach((sd) => {
        const ear = sphere(0.042, skin)
        ear.scale.set(0.45, 1, 0.75)
        ear.position.set(sd * 0.186, 0, 0.012)
        g.add(ear)
      })
      // Ojos: esclerótica, iris, pupila, brillo, párpado (parpadea) y pestañas
      this.lids = []
      ;[-1, 1].forEach((sd) => {
        const x = sd * 0.066
        const eye = new THREE.Group()
        eye.position.set(x, 0.028, -0.148)
        const scl = sphere(0.029, mat('#F4F1EC', { roughness: 0.25 }))
        scl.scale.set(1, 0.82, 0.62)
        eye.add(scl)
        const iris = sphere(0.0165, irisMat(a.eyes))
        iris.position.set(0, 0, -0.012)
        iris.scale.set(1, 1, 0.6)
        eye.add(iris)
        const pupil = sphere(0.0095, mat('#080808', { roughness: 0.1 }))
        pupil.position.set(0, 0, -0.019)
        eye.add(pupil)
        const hl = sphere(0.0045, new THREE.MeshBasicMaterial({ color: 0xffffff }))
        hl.position.set(0.006, 0.007, -0.024)
        eye.add(hl)
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.035, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin)
        lid.scale.set(1.02, 0.86, 0.66)
        lid.rotation.x = -0.55
        eye.add(lid)
        this.lids.push(lid)
        if (woman) {
          const lash = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.012), mat('#151515'))
          lash.position.set(sd * 0.006, 0.026, -0.012)
          lash.rotation.z = sd * -0.15
          eye.add(lash)
        }
        g.add(eye)
        // ceja
        const brow = capsule(a.brows === 'gruesas' ? 0.009 : 0.005, 0.05, mat(shade(a.hairColor, 0.9)))
        brow.rotation.z = Math.PI / 2 + sd * (a.expression === 'alegre' ? -0.18 : a.expression === 'tranquila' ? 0.05 : -0.08)
        brow.position.set(x, 0.082, -0.172)
        g.add(brow)
      })
      // Nariz
      const nose = capsule(0.014, 0.03, mat(shade(a.skin, 0.95), { roughness: 0.5 }))
      nose.position.set(0, 0.0, -0.188)
      nose.rotation.x = -0.25
      g.add(nose)
      const tip = sphere(0.019, mat(shade(a.skin, 0.95)))
      tip.position.set(0, -0.022, -0.196)
      tip.scale.set(1.15, 0.8, 0.9)
      g.add(tip)
      // Boca
      const lipC = shade(a.skin, 0.72)
      const lipM = mat(woman ? '#C2666B' : lipC, { roughness: 0.45 })
      const mouth = new THREE.Group()
      mouth.position.set(0, -0.068, -0.18)
      if (a.expression === 'alegre') {
        const inner = new THREE.Mesh(new THREE.CircleGeometry(0.032, 24, Math.PI, Math.PI), new THREE.MeshStandardMaterial({ color: '#5A1E1E', side: THREE.DoubleSide }))
        inner.scale.set(1.2, 1, 1)
        mouth.add(inner)
        const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.004), mat('#FFFFFF'))
        teeth.position.set(0, -0.004, -0.002)
        mouth.add(teeth)
      }
      const upper = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 20, Math.PI), lipM)
      upper.rotation.z = Math.PI
      upper.scale.set(1.25, a.expression === 'tranquila' ? 0.15 : a.expression === 'alegre' ? 0.35 : 0.55, 1)
      mouth.add(upper)
      const lower = capsule(0.009, 0.035, lipM)
      lower.rotation.z = Math.PI / 2
      lower.position.set(0, a.expression === 'alegre' ? -0.03 : -0.014, 0.004)
      mouth.add(lower)
      this.mouth = mouth
      g.add(mouth)
      // Mejillas
      ;[-1, 1].forEach((sd) => {
        const c = sphere(0.032, new THREE.MeshStandardMaterial({ color: '#F09A9A', transparent: true, opacity: woman ? 0.12 : 0.05, roughness: 1 }))
        c.position.set(sd * 0.11, -0.03, -0.14)
        c.scale.set(1, 0.7, 0.4)
        g.add(c)
      })
      const prev = this.el.getObject3D('face')
      if (prev) this.el.removeObject3D('face')
      this.el.setObject3D('face', g)
      this.nextBlink = 0
      this.talking = false
    },
    setTalking(on) { this.talking = on },
    tick(t) {
      if (!this.lids) return
      // Parpadeo cada 3 a 6 segundos
      if (!this.nextBlink) this.nextBlink = t + 2000 + Math.random() * 3000
      const dt = t - this.nextBlink
      const closed = dt > 0 && dt < 140
      this.lids.forEach((l) => { l.rotation.x = closed ? 0.35 : -0.55 })
      if (dt > 140) this.nextBlink = t + 3000 + Math.random() * 3000
      if (this.mouth) this.mouth.scale.y = this.talking ? 1 + Math.abs(Math.sin(t / 90)) * 1.4 : 1
    },
    remove() { this.el.removeObject3D('face') }
  })
}
