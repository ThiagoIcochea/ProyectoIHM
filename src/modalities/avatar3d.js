// Cuerpo y cara de los personajes con geometría propia (three.js): silueta torneada, extremidades con
// articulaciones, manos con pulgar, mandíbula modelada, párpados que parpadean, labios y respiración.
// El pelo y los accesorios se siguen agregando como entidades A-Frame sobre esta base.
import { normalizeAvatar } from './avatars'

export function registerAvatar(A) {
  if (A.components['avatar-body']) return
  const THREE = A.THREE
  const V2 = (x, y) => new THREE.Vector2(x, y)
  const mats = {}
  const mat = (color, opts = {}) => {
    const k = color + JSON.stringify(opts)
    if (!mats[k]) mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, ...opts })
    return mats[k]
  }
  const cloth = (color) => mat(color, { roughness: 0.85 })
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
  const limb = (a, b, r, m) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    const len = dir.length()
    const mesh = capsule(r, Math.max(0.001, len - r * 0.2), m)
    mesh.position.copy(a).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
    return mesh
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
      const skin = mat(a.skin, { roughness: 0.55 })
      const top = cloth(a.outfit)
      const pants = cloth(a.pants)
      const shoes = mat(a.shoes, { roughness: 0.5 })
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
        const cape = lathe([[0.075, 1.22], [W(0.22), 1.13], [W(0.34), 0.98], [W(0.41), 0.78], [W(0.405), 0.77]], top, 0.82)
        g.add(cape)
        ;[['#F4F1EA', 0.84], ['#E0A43A', 0.88], [shade(a.outfit, 0.6), 0.92]].forEach(([c, y]) => {
          const r = W(0.41 - ((y - 0.78) / 0.2) * 0.07)
          g.add(lathe([[r + 0.004, y], [r - 0.003, y + 0.025]], cloth(c), 0.82))
        })
      }
      // Cuello
      const neck = capsule(0.052, 0.07, skin)
      neck.position.set(0, 1.27, 0)
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
        arm.add(Object.assign(sphere(W(0.062), sleeveTop), {}))
        arm.add(limb(new THREE.Vector3(0, 0, 0), elbow, W(0.048), sleeveTop))
        arm.add(limb(elbow, wrist, W(0.041), longSleeve ? top : skin))
        if (longSleeve) {
          const cuff = new THREE.Mesh(new THREE.TorusGeometry(W(0.043), 0.008, 8, 20), cloth(shade(a.outfit, 0.75)))
          cuff.position.copy(wrist).lerp(elbow, 0.12)
          cuff.rotation.x = Math.PI / 2
          arm.add(cuff)
        }
        const hand = new THREE.Group()
        hand.position.copy(wrist).add(new THREE.Vector3(0, -0.055, -0.005))
        const palm = sphere(0.042, skin)
        palm.scale.set(0.85, 1.25, 0.55)
        hand.add(palm)
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
        g.add(limb(hip, knee, W(0.072), legM))
        g.add(limb(knee, ankle, W(0.056), legM))
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
    tick(t) {
      if (!this.torso) return
      const s = (t / 1000 + this.t0)
      // respiración y balanceo suave de los brazos
      const br = 1 + Math.sin(s * 1.4) * 0.012
      this.torso.scale.set(br, 1 + Math.sin(s * 1.4) * 0.006, br)
      this.arms?.forEach((arm) => { arm.rotation.z = arm.userData.side * (0.04 + Math.sin(s * 0.9) * 0.025); arm.rotation.x = Math.sin(s * 0.7 + arm.userData.side) * 0.03 })
    },
    remove() { this.el.removeObject3D('body') }
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
      const skin = mat(a.skin, { roughness: 0.5 })
      // Cabeza con mandíbula más angosta y mentón suave
      const hg = new THREE.SphereGeometry(0.19, 48, 36)
      const p = hg.attributes.position
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i)
        let y = p.getY(i)
        let z = p.getZ(i)
        if (y < 0) {
          const k = Math.pow(-y / 0.19, 1.6)
          x *= 1 - (woman ? 0.24 : 0.17) * k
          z *= 1 - 0.1 * k
          if (z < 0) z -= 0.012 * k
        }
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
        const scl = sphere(0.033, mat('#FFFFFF', { roughness: 0.25 }))
        scl.scale.set(1, 0.82, 0.62)
        eye.add(scl)
        const iris = sphere(0.019, mat(a.eyes, { roughness: 0.15 }))
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
        const c = sphere(0.032, new THREE.MeshStandardMaterial({ color: '#F09A9A', transparent: true, opacity: woman ? 0.32 : 0.12, roughness: 1 }))
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
