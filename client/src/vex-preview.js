import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import './vex-preview.css'

const viewer = document.querySelector('#viewer')
const status = document.querySelector('#status')
const toggle = document.querySelector('#toggle')
const animation = document.querySelector('#animation')
const scene = new THREE.Scene()
scene.background = new THREE.Color('#071321')
const camera = new THREE.PerspectiveCamera(36, 1, .05, 40)
camera.position.set(2.8, 1.75, 3.2)
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
renderer.outputColorSpace = THREE.SRGBColorSpace
viewer.appendChild(renderer.domElement)
const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, .9, 0)
controls.enableDamping = true
controls.minDistance = 1.5
controls.maxDistance = 6
controls.maxPolarAngle = Math.PI * .65
controls.saveState()
scene.add(new THREE.HemisphereLight(0xb8e7ff, 0x152035, 2.1))
const light = new THREE.DirectionalLight(0xe5f7ff, 2.2)
light.position.set(3, 5, 4)
scene.add(light)
const floor = new THREE.Mesh(new THREE.CircleGeometry(1.2, 48), new THREE.MeshStandardMaterial({ color: 0x122b3b, roughness: .9 }))
floor.rotation.x = -Math.PI / 2
floor.position.y = -.015
scene.add(floor)
let mixer, currentModel, playing = true, previous = performance.now()
const loaded = new Map()
const loader = new GLTFLoader()
async function selectAnimation(name) {
  animation.disabled = true
  status.textContent = 'Loading VEX…'
  try {
    let entry = loaded.get(name)
    if (!entry) {
      const gltf = await loader.loadAsync(`/vex-preview/vex-${name}.glb`)
      if (!gltf.animations.length) throw new Error('Animation is missing')
      const animationMixer = new THREE.AnimationMixer(gltf.scene)
      gltf.animations.forEach(clip => animationMixer.clipAction(clip).play())
      entry = { model: gltf.scene, mixer: animationMixer }
      loaded.set(name, entry)
    }
    if (currentModel) scene.remove(currentModel)
    currentModel = entry.model
    mixer = entry.mixer
    scene.add(currentModel)
    status.textContent = `${name === 'walk' ? 'Walk' : 'Idle'} animation loaded.`
  } catch {
    status.textContent = 'Could not load the VEX preview. Please refresh the page.'
  } finally {
    animation.disabled = false
  }
}
animation.addEventListener('change', () => selectAnimation(animation.value))
selectAnimation('walk')
toggle.addEventListener('click', () => {
  playing = !playing
  toggle.textContent = playing ? 'Pause animation' : 'Play animation'
})
document.querySelector('#reset').addEventListener('click', () => controls.reset())
function resize() {
  const width = viewer.clientWidth, height = viewer.clientHeight
  renderer.setSize(width, height, false)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(viewer)
renderer.setAnimationLoop(now => {
  const delta = Math.min((now - previous) / 1000, .1)
  previous = now
  if (playing && mixer) mixer.update(delta)
  controls.update()
  renderer.render(scene, camera)
})

