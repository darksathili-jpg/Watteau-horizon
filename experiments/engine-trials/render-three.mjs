import * as THREE from 'three'
import { scene as layout } from './model.mjs'

const palette = {
  sky: '#536c85', ground: '#344a57', path: '#687584', active: '#ffab88', idle: '#85a8c2',
  vest: '#98485d', hoodie: '#e4e5df', hair: '#49353c', skin: '#c08067',
  trousers: '#34475f', pack: '#35485b', shoe: '#222c42',
}

export function createRenderer(container, _read, ready, rendered) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'default' })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-hidden', 'true')
  container.append(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(palette.sky)
  scene.fog = new THREE.Fog(palette.sky, 27, 55)
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90)
  const ambient = new THREE.HemisphereLight('#b2c9ec', '#7d6d63', 2.05)
  const sunlight = new THREE.DirectionalLight('#ffd0ad', 2.45)
  sunlight.position.set(-5, 10, 5)
  sunlight.castShadow = true
  sunlight.shadow.camera.left = sunlight.shadow.camera.bottom = -17
  sunlight.shadow.camera.right = sunlight.shadow.camera.top = 17
  sunlight.shadow.camera.far = 34
  sunlight.shadow.mapSize.set(1024, 1024)
  sunlight.shadow.normalBias = 0.024
  scene.add(ambient, sunlight)

  const surfaces = new Map()
  function material(color) {
    if (!surfaces.has(color)) surfaces.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.87 }))
    return surfaces.get(color)
  }
  function mesh(geometry, color, x, y, z, parent = scene, castsShadow = true) {
    const object = new THREE.Mesh(geometry, material(color))
    object.position.set(x, y, z)
    object.castShadow = castsShadow
    object.receiveShadow = true
    parent.add(object)
    return object
  }
  const box = (w, h, d, color, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent)
  mesh(new THREE.BoxGeometry(layout.world.width + 5, 0.18, layout.world.depth + 4), palette.ground, 0, -0.105, 0, scene, false)
  for (const path of layout.paths) mesh(new THREE.BoxGeometry(path.w, 0.027, path.d), palette.path, path.x, 0.008, path.z, scene, false)
  for (let x = -11; x <= 11; x += 2) {
    mesh(new THREE.BoxGeometry(0.017, 0.01, 15.8), '#3e5360', x, 0.002, 0, scene, false)
  }
  for (let z = -7; z <= 7; z += 2) {
    mesh(new THREE.BoxGeometry(23.8, 0.01, 0.017), '#3e5360', 0, 0.002, z, scene, false)
  }

  for (const building of layout.buildings) {
    const { w, h, d, x, z, color } = building
    const front = z + d / 2
    box(w, h, d, color, x, h / 2, z)
    box(w + 0.28, 0.18, d + 0.26, '#29394d', x, h + 0.03, z)
    box(w + 0.08, 0.18, 0.1, '#2b4053', x, 0.16, front + 0.03)
    for (let column = -2; column <= 2; column += 1) {
      for (const row of [1.82, h - 0.83]) {
        if (row < 2.05 && column === 0) continue
        box(0.75, 0.62, 0.1, '#31475c', x + column * 1.04, row, front + 0.018)
        box(0.61, 0.46, 0.08, column % 2 ? '#8e7f76' : '#718f9e', x + column * 1.04, row, front + 0.078)
      }
    }
    box(1.02, 1.5, 0.14, '#253744', x, 0.75, front + 0.02)
    box(1.64, 0.13, 0.77, '#7795a0', x, 1.53, front + 0.30)
  }
  for (const planter of layout.obstacles) {
    const { w, h, d, x, z, color } = planter
    box(w, h, d, color, x, h / 2, z)
    box(w - 0.22, 0.035, d - 0.22, '#3f564f', x, h + 0.013, z)
    for (const offset of [-0.95, -0.32, 0.32, 0.95]) {
      const foliage = new THREE.IcosahedronGeometry(0.44, 0)
      mesh(foliage, offset > 0 ? '#648878' : '#527565', x + offset, h + 0.18, z)
    }
  }
  const pads = layout.stations.map(({ x, z }) => {
    mesh(new THREE.CylinderGeometry(0.77, 0.82, 0.11, 32), '#425d6b', x, 0.055, z)
    const ring = new THREE.TorusGeometry(0.62, 0.028, 8, 40)
    const mark = mesh(ring, palette.idle, x, 0.125, z, scene, false)
    mark.rotation.x = -Math.PI / 2
    return mark
  })

  const player = new THREE.Group()
  scene.add(player)
  const sphere = (r, sx, sy, sz, color, x, y, z, parent) => {
    const object = mesh(new THREE.SphereGeometry(r, 14, 9), color, x, y, z, parent)
    object.scale.set(sx, sy, sz)
    return object
  }
  box(0.43, 0.51, 0.28, palette.vest, 0, 1.02, 0, player)
  box(0.25, 0.43, 0.30, palette.hoodie, 0, 1.04, 0.015, player)
  box(0.36, 0.38, 0.14, palette.pack, 0, 1.01, -0.185, player)
  sphere(0.137, 0.98, 1.1, 0.94, palette.skin, 0, 1.52, 0.016, player)
  sphere(0.136, 1.06, 0.79, 1.02, palette.hair, 0, 1.61, -0.015, player)
  for (const x of [-0.141, 0.141]) {
    box(0.048, 0.09, 0.075, '#657689', x, 1.53, 0.009, player)
  }
  const limbs = [-1, 1].map((side) => {
    const leg = new THREE.Group()
    leg.position.set(side * 0.115, 0.78, 0)
    player.add(leg)
    box(0.155, 0.68, 0.153, palette.trousers, 0, -0.36, 0, leg)
    box(0.17, 0.094, 0.25, palette.shoe, 0, -0.727, 0.042, leg)
    const arm = new THREE.Group()
    arm.position.set(side * 0.261, 1.235, 0)
    player.add(arm)
    box(0.115, 0.4, 0.122, palette.hoodie, 0, -0.21, 0, arm)
    sphere(0.056, 0.92, 1.14, 0.86, palette.skin, 0, -0.43, 0, arm)
    return { leg, arm, side }
  })

  let width = 0
  let height = 0
  let previousStation = -1
  ready()
  return {
    draw(state) {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w <= 0 || h <= 0) return
      if (width !== w || height !== h) {
        width = w
        height = h
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      if (state.active !== previousStation) {
        for (const [index, pad] of pads.entries()) pad.material = material(index === state.active ? palette.active : palette.idle)
        previousStation = state.active
      }
      const stride = state.walking && !state.reduced ? Math.sin(state.step) : 0
      player.position.set(state.x, Math.abs(stride) * 0.045, state.z)
      player.rotation.y = state.yaw
      for (const { leg, arm, side } of limbs) {
        leg.rotation.x = side * stride * 0.57
        arm.rotation.x = -side * stride * 0.49
      }
      camera.position.set(state.cameraX, 5.6, state.cameraZ + 7.5)
      camera.lookAt(state.cameraX, 1.1, state.cameraZ - 1.8)
      renderer.render(scene, camera)
      rendered()
    },
  }
}
