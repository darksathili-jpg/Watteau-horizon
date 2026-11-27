import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { advance, direction, distance, markers, start } from './world.mjs'

const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}`
const up = new THREE.Vector3(0, 1, 0)
const look = new THREE.Vector3()
const follow = new THREE.Vector3()
const move = new THREE.Vector3()
const ndc = new THREE.Vector3()
const walkSpeed = 1.45
const runSpeed = 3.15
const walkClipSpeed = 1.05
const runClipSpeed = 2.31
const actions = ['Idle', 'Walk', 'Run', 'Turn', 'Interact', 'Dialogue']

function character(gltf, scene) {
  scene.add(gltf.scene)
  const mixer = new THREE.AnimationMixer(gltf.scene)
  const clips = new Map(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]))
  if (actions.some((name) => !clips.has(name))) throw new Error('Animations du personnage incomplètes.')
  let active = null
  const played = new Set()
  const heels = ['FootL', 'FootR'].map((name) => gltf.scene.getObjectByName(name))
  return {
    object: gltf.scene,
    mixer,
    jointSamples: () => heels.map((joint) => joint?.getWorldPosition(new THREE.Vector3()).toArray() ?? null),
    activate(name) {
      if (name === active) return
      const next = clips.get(name)
      if (active) clips.get(active).fadeOut(.16)
      next.reset().fadeIn(.16).play()
      active = name
      played.add(name)
    },
    duration: (name) => clips.get(name).getClip().duration,
    get active() { return active },
    get played() { return [...played] },
  }
}

function skyDome() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { tint: { value: new THREE.Color('#8faebc') } },
    vertexShader: `varying vec3 point;
      void main() { point = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec3 point; uniform vec3 tint;
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=fract(sin(dot(i, vec2(127.1,311.7)))*43758.5453);
        float b=fract(sin(dot(i+vec2(1.,0.), vec2(127.1,311.7)))*43758.5453);
        float c=fract(sin(dot(i+vec2(0.,1.), vec2(127.1,311.7)))*43758.5453);
        float d=fract(sin(dot(i+1., vec2(127.1,311.7)))*43758.5453);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
      }
      void main() {
        vec3 d=normalize(point);
        vec3 col=mix(vec3(.65,.72,.73), tint*.67,smoothstep(0.,.68,d.y));
        vec2 q=d.xz / (max(.0,d.y)+.4) * 6.;
        float detail=noise(q)*.65 + noise(q*2.05)*.24 + noise(q*4.1)*.11;
        float cloud=smoothstep(.48,.72,detail)*smoothstep(.02,.22,d.y);
        col=mix(col,vec3(.96,.89,.77),cloud*.75);
        float light=pow(max(dot(d,normalize(vec3(-.6,.39,.64))),0.),8.);
        gl_FragColor=vec4(col+light*vec3(.4,.19,.07),1.);
        #include <colorspace_fragment>
      }
    `,
  })
  const sky = new THREE.Mesh(new THREE.SphereGeometry(74, 28, 18), material)
  sky.renderOrder = 10
  return sky
}

function contactTexture() {
  const size = 32
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4
    const radius = Math.hypot((x + .5) / size - .5, (y + .5) / size - .5) * 2
    data[index + 3] = Math.round(Math.max(0, 1 - radius) ** 1.5 * 125)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

export async function mountEngine(container, callbacks, signal) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  const size = { width: 0, height: 0 }
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1, .055, 145)
  let frame = 0
  let observer
  let disposed = false
  let texture
  const dispose = () => {
    if (disposed) return
    disposed = true
    signal.removeEventListener('abort', dispose)
    renderer.domElement.removeEventListener('webglcontextlost', contextLost)
    cancelAnimationFrame(frame)
    observer?.disconnect()
    scene.traverse((object) => {
      object.geometry?.dispose()
      if (object.material) for (const material of [object.material].flat()) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose()
        material.dispose()
      }
    })
    texture?.dispose()
    renderer.dispose()
    renderer.domElement.remove()
  }
  function contextLost(event) {
    event.preventDefault()
    dispose()
    callbacks.onError('Le contexte graphique a été perdu.')
  }
  signal.addEventListener('abort', dispose, { once: true })
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.13
    renderer.domElement.setAttribute('aria-hidden', 'true')
    renderer.domElement.addEventListener('webglcontextlost', contextLost)
    scene.fog = new THREE.FogExp2('#a8a9a2', .011)
    scene.add(skyDome())
    scene.add(new THREE.HemisphereLight('#dce8ff', '#967650', 1.9))
    const sun = new THREE.DirectionalLight('#ffdb9d', 2.9)
    sun.position.set(-12, 15, 9)
    sun.target.position.set(0, 0, -4)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: .5, far: 60 })
    sun.shadow.bias = -.00045
    sun.shadow.normalBias = .035
    sun.shadow.autoUpdate = false
    sun.shadow.needsUpdate = true
    scene.add(sun, sun.target)
    const textureErrors = []
    const manager = new THREE.LoadingManager()
    manager.onError = (resource) => textureErrors.push(resource)
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder)
    const modelNames = ['campus.glb', 'avatar.glb', 'antoine.glb']
    const models = await Promise.all(modelNames.map(async (name) => {
      const response = await fetch(asset(name), { signal })
      if (!response.ok) throw new Error(`Ressource graphique indisponible (${name}).`)
      return loader.parseAsync(await response.arrayBuffer(), '')
    }))
    if (signal.aborted) throw signal.reason
    if (textureErrors.length) throw new Error('Certaines textures intégrées sont indisponibles.')

    const [campus, avatarGltf, antoineGltf] = models
    campus.scene.traverse((object) => {
      if (!object.isMesh) return
      object.receiveShadow = true
      object.castShadow = !/ground|pav|sol|leaf.?litter/i.test(object.name)
    })
    scene.add(campus.scene)
    const player = character(avatarGltf, scene)
    const companion = character(antoineGltf, scene)
    companion.object.position.set(0, 0, -2)
    companion.object.rotation.y = -.15
    player.object.rotation.y = Math.PI
    texture = contactTexture()
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .82), new THREE.MeshBasicMaterial({
      map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    }))
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = .018
    scene.add(shadow)
    const fixedShadow = shadow.clone()
    fixedShadow.position.set(0, .018, -2)
    scene.add(fixedShadow)

    const position = { ...start }
    const controls = callbacks.controls
    const sample = { values: null }
    const metrics = { renderer: renderer.getContext().getParameter(renderer.getContext().RENDERER) }
    const debug = renderer.getContext().getExtension('WEBGL_debug_renderer_info')
    if (debug) metrics.gpu = renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL)
    let last = 0
    let lastHud = -100
    let movementSpeed = 0
    let gestureUntil = 0
    let turnUntil = 0
    let previousDirection = Math.PI
    const animate = (now) => {
      if (disposed) return
      try {
        const dt = last ? Math.min(.55, (now - last) / 1000) : 0
        const [dx, dz] = direction(controls.keys)
        const running = controls.keys.has('run') && !controls.reduced
        const targetSpeed = controls.paused || (!dx && !dz) ? 0 : running ? runSpeed : walkSpeed
        const px = position.x, pz = position.z
        movementSpeed = THREE.MathUtils.damp(movementSpeed, targetSpeed, 11, dt)
        if (targetSpeed) advance(position, dx * movementSpeed * dt, dz * movementSpeed * dt)
        const actualSpeed = dt ? distance(position, { x: px, z: pz }) / dt : 0
        let turnDelta = 0
        if (targetSpeed) {
          previousDirection = Math.atan2(dx, dz)
          turnDelta = Math.atan2(Math.sin(previousDirection - player.object.rotation.y), Math.cos(previousDirection - player.object.rotation.y))
          if (Math.abs(turnDelta) > 1.65 && now >= turnUntil) turnUntil = now + 255
          player.object.rotation.y += turnDelta * (controls.reduced ? 1 : 1 - Math.exp(-14 * dt))
        }
        player.object.position.set(position.x, 0, position.z)
        shadow.position.x = position.x
        shadow.position.z = position.z
        const wanted = now < gestureUntil && !controls.reduced ? 'Interact'
          : !actualSpeed ? 'Idle' : now < turnUntil && !controls.reduced ? 'Turn' : running ? 'Run' : 'Walk'
        player.activate(wanted)
        companion.activate(controls.dialogue && !controls.reduced ? 'Dialogue' : 'Idle')
        const strideRate = wanted === 'Walk' ? THREE.MathUtils.clamp(actualSpeed / walkClipSpeed, .18, 1.45)
          : wanted === 'Run' ? THREE.MathUtils.clamp(actualSpeed / runClipSpeed, .32, 1.4) : 1
        player.mixer.update(controls.reduced && wanted === 'Idle' ? 0 : dt * strideRate)
        companion.mixer.update(controls.reduced ? 0 : dt)
        const mobile = size.width < size.height
        const followX = mobile ? .28 : .65
        if (controls.map) {
          follow.set(0, 27, 12)
          look.set(0, 0, -2)
        } else {
          follow.set(position.x + followX, 1.62, position.z + (mobile ? 4.1 : 3.1))
          look.set(position.x + followX * .62, 1.53, position.z - 4.2)
        }
        camera.position.lerp(follow, !last || controls.reduced ? 1 : 1 - Math.exp(-8 * dt))
        if (!last || controls.reduced) move.copy(look)
        else move.lerp(look, 1 - Math.exp(-9 * dt))
        camera.up.copy(up)
        camera.lookAt(move)
        renderer.render(scene, camera)
        if (sample.values && last) sample.values.push(now - last)
        last = now

        const marker = markers[controls.stage]
        if (marker) {
          ndc.set(marker.x, controls.stage === 0 ? 2.0 : 1.81, marker.z).project(camera)
          callbacks.positionMarker(ndc.x, ndc.y, ndc.z < 1 && Math.abs(ndc.x) < .86 && Math.abs(ndc.y) < .76)
        }
        if (now - lastHud > 95) {
          lastHud = now
          callbacks.updateHud(position, marker ? distance(position, marker) : 0)
        }
        frame = requestAnimationFrame(animate)
      } catch (error) {
        dispose()
        callbacks.onError(error.message)
      }
    }

    const sizeCanvas = () => {
      size.width = Math.max(1, container.clientWidth)
      size.height = Math.max(1, container.clientHeight)
      camera.fov = size.width < size.height ? 47 : 48
      camera.aspect = size.width / size.height
      camera.updateProjectionMatrix()
      renderer.setSize(size.width, size.height, false)
    }
    sizeCanvas()
    observer = new ResizeObserver(sizeCanvas)
    observer.observe(container)
    container.append(renderer.domElement)
    animate(performance.now())
    if (disposed) throw new Error('Le premier rendu graphique a échoué.')
    return {
      dispose,
      gesture: () => { gestureUntil = performance.now() + player.duration('Interact') * 1000 },
      observe: () => ({
        ...metrics, ...position, animation: player.active, antoine: companion.active,
        camera: camera.position.toArray(), triangles: renderer.info.render.triangles,
        drawCalls: renderer.info.render.calls, textures: renderer.info.memory.textures,
        feet: player.jointSamples(), clipsPlayed: { avatar: player.played, antoine: companion.played },
      }),
      sample: (enabled) => {
        const previous = sample.values
        sample.values = enabled ? [] : null
        return previous
      },
    }
  } catch (error) {
    dispose()
    throw error
  }
}
