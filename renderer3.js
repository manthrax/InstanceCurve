import*as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'

const container = document.createElement('div')
container.style.position = 'fixed'
container.style.top = '0'
container.style.left = '0'
container.style.right = '0'
container.style.bottom = '0'
document.body.appendChild(container)

const scene = new THREE.Scene()
scene.background = new THREE.Color('lightblue')

const dirLight = new THREE.DirectionalLight('white',1.8)
dirLight.position.set(-1, 1.75, 1)
dirLight.position.multiplyScalar(70)
dirLight.castShadow = true
dirLight.shadow.mapSize.width = 1024
dirLight.shadow.mapSize.height = 1024
dirLight.shadow.camera.top = dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.bottom = dirLight.shadow.camera.left = -50;
dirLight.shadow.camera.updateProjectionMatrix();
scene.add(dirLight)

const light = new THREE.AmbientLight('white',1.7)
scene.add(light)

const camera = new THREE.PerspectiveCamera(75,window.innerWidth / window.innerHeight,0.1,1000)
const renderer = new THREE.WebGLRenderer({
    antialias: true
})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera,renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.screenSpacePanning = false
controls.minDistance = 1
controls.maxDistance = 500
controls.maxPolarAngle = Math.PI / 2

controls.target.set(10,.5,30)
camera.position.set(10,15,15)

container.appendChild(renderer.domElement)


const pmremGenerator = new THREE.PMREMGenerator(renderer);
let renderTarget = pmremGenerator.fromScene(scene, 0, .1, 10000.);
scene.environment = renderTarget.texture;
pmremGenerator.dispose();

export {THREE,scene,camera,controls,renderer,dirLight}