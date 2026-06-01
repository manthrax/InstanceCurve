import *as renderer3 from './renderer3.js'
let { THREE, scene, camera, controls, renderer, dirLight } = renderer3;
let tick = 0
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import Environment from "./cool-env.js"

let gui = new GUI();

let onWindowResize = (event) => {
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

onWindowResize();
window.addEventListener("resize", onWindowResize, false);

import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
let mixer = new THREE.AnimationMixer();
let loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let glb = await loader.loadAsync('./parts.glb')

let frameTasks = []


import { ConveyorBeltNetwork, generateCurve } from "./ConveyorBeltNetwork.js"
import { extractPolylines } from './geometryUtils.js';


let env = new Environment(renderer, scene, camera);


let path = glb.scene.getObjectByName('path');
let pts = []

const { paths, closed } = extractPolylines(path.geometry);

let pa = path.geometry.attributes.position.array;
let pi = path.geometry.index.array;
for (let i = 0; i < pi.length; i += 2) {
    let id = pi[i] * 3;
    pts.push(new THREE.Vector3(pa[id], pa[id + 1], pa[id + 2]));
}
//scene.add(path);

const beltNetwork = new ConveyorBeltNetwork();

// Set up the single conveyor belt network

// Set curves in the network
const curves = paths.map((pathPts, i) => generateCurve(pathPts, 100, closed[i]));
beltNetwork.setCurves(curves);



let addObj = ({ name = '', px, py = 0, pz, sx, sy, sz, len = 1, fixed = false, bend = true }) => {
    let o = glb.scene.getObjectByName(name)
    o.geometry.scale(sx || 1, sy || 1, sz || 1)
    py && o.geometry.translate(px || 0, py, pz || 0)
    beltNetwork.registerItemType(name, o.geometry, o.material, bend);
}
addObj({ name: 'belt-frame', bend: true, fixed: true, py: -1 })
addObj({ name: 'belt', bend: true, fixed: false, py: -1 })
addObj({ name: 'grill', bend: false, py: 1.5 })
addObj({ name: 'fins', bend: false, py: -3 })
addObj({ name: 'rope', bend: true, py: -4 })
addObj({ name: 'cylinder', bend: false, py: -5 })
addObj({ name: 'cube-bevel', bend: false, py: -2 })


// Populate the conveyor belt automatically with evenly spaced items
beltNetwork.populateBelt();

// Add the visual network group to the scene
scene.add(beltNetwork.object);

let beltSpeedSetting = 0.1; // Default speed

window.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') {
        beltSpeedSetting = Math.min(1.0, Math.round((beltSpeedSetting + 0.01) * 100) / 100);
        console.log(`Belt Advance Speed Setting: ${beltSpeedSetting}`);
    } else if (e.key === '-' || e.key === '_') {
        beltSpeedSetting = Math.max(0.0, Math.round((beltSpeedSetting - 0.01) * 100) / 100);
        console.log(`Belt Advance Speed Setting: ${beltSpeedSetting}`);
    }
});

frameTasks.push((dt, tnow) => {
    tnow /= 4000;
    let snow = Math.abs(Math.sin(tnow)) * .3;
    let move = beltSpeedSetting * snow * dt;
    beltNetwork.advance(move);
}
)

//editing:

const ACTION_SELECT = 1
    , ACTION_NONE = 0;
let action = ACTION_NONE;
const curveHandles = beltNetwork.curves.reduce((acc, cur) => acc.concat(cur.curveHandles), []);
// [];
const rayCaster = new THREE.Raycaster()
const mouse = new THREE.Vector2();

let control = new TransformControls(camera, renderer.domElement);
//control.addEventListener( 'dragging-changed', function ( event ) {

control.addEventListener('objectChange', function (event) {

    if (!event.value) {

        beltNetwork.curves.forEach(function (curve, i) {
            beltNetwork.updateCurveGeometry(i);
        });

    }

});

function getCurveHandleUnderMouse() {
    rayCaster.setFromCamera(mouse, camera);
    const intersects = rayCaster.intersectObjects(curveHandles, false);
    if (intersects.length)
        return intersects[0];
}

function onPointerDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    let underMouse = getCurveHandleUnderMouse()
    if (underMouse && (!control.parent)) {
        action = ACTION_SELECT;
        const target = underMouse.object;
        control.attach(target);
        scene.add(control.getHelper());
    } else if (underMouse) {
        scene.attach(control.object);
        scene.remove(control)
    }
}

function onPointerUp(event) {

    controls.enabled = true;
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);

renderer.domElement.addEventListener('pointerup', onPointerUp);

frameTasks.push(() => {

    if (action === ACTION_SELECT) {
        action = ACTION_NONE;

    }
    controls.enabled = !control.dragging;
}
)
// Restore camera & controls target from sessionStorage if present
const savedCamPos = sessionStorage.getItem('camera_position');
const savedTarget = sessionStorage.getItem('controls_target');
if (savedCamPos) {
    camera.position.copy(JSON.parse(savedCamPos));
} else {
    camera.position.copy({ x: -2.9792360807388114, y: 21.437020914188018, z: -3.430905503015784 });
}

if (savedTarget) {
    controls.target.copy(JSON.parse(savedTarget));
} else {
    controls.target.copy({ x: -4.806586624771589, y: 0.49999999999999417, z: -3.940806163796212 });
}
controls.update();

let lastTime = performance.now();

window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('camera_position', JSON.stringify({ x: camera.position.x, y: camera.position.y, z: camera.position.z }));
    sessionStorage.setItem('controls_target', JSON.stringify({ x: controls.target.x, y: controls.target.y, z: controls.target.z }));
});

const updateAndDraw = () => {
    requestAnimationFrame(updateAndDraw)
    let now = performance.now();
    let dt = now - lastTime;
    if (dt == 0) return;
    lastTime = now;
    tick++
    frameTasks.forEach(ft => ft(dt, now));
    mixer.update(dt);
    controls.update(dt)

    renderer.render(scene, camera)
}
updateAndDraw()

/*

vtex  rgba8
vgeom rgba f32




texid, weight, texid, weight,



render world space material LOD and layers into texture space.. as the mapping texture
mapping texture contains tile LOD+blend and tile index = rgba8

disable filtering and implement it as blends between adjacent LODs
----
||||
----



component
    properties
    data

*/

/*
//let glb = await loader.loadAsync('https://cdn.glitch.global/b427b473-8d54-42e2-81cb-be44935606a2/trash%20(1).glb?v=1712036962228')
//let glb1 = await loader.loadAsync('https://cdn.glitch.global/b427b473-8d54-42e2-81cb-be44935606a2/hier.glb?v=1712036507729')
//scene.add(glb.scene)
import InstanceGroup from "./InstanceGroup.js"
let instanceGroup = new InstanceGroup()
scene.add(instanceGroup)

let tiles = []
//debugger
let spacing = 10
let rowsize = 50
if (0)
    for (let i = 0; i < (rowsize * rowsize); i++) {
        let cd = (Math.random() * glb.scene.children.length) | 0
        let clone = glb.scene.children[cd].children[0].clone();
        //clone.traverse(e=>e.isMesh&&(e.material.metalness=0))

        //let gp=clone;  
        let gp = new THREE.Object3D();
        gp.add(clone);
        gp.position.x = (i % rowsize) * spacing;
        gp.position.z = ((i / rowsize) | 0) * spacing;
        gp.updateMatrixWorld();

        /*
    let action = mixer.clipAction(glb.animations[0],gp);
    action.play();
    action.time = Math.random()
    action.timeScale = Math.random()+.1
    */
/*
        instanceGroup.add(gp);
        //scene.add(gp);
        tiles.push(gp);
    }

if(0)
for(let i=0;i<(rowsize*rowsize);i++){
  let cd = (Math.random()*glb1.scene.children.length)|0
    let clone = glb1.scene.children[cd].clone();
    //clone.traverse(e=>e.isMesh&&(e.material.metalness=0))

    //let gp=clone;  
    let gp = new THREE.Object3D();
    gp.add(clone);
    gp.position.x = (i%rowsize)*spacing;
    gp.position.z = ((i/rowsize)|0)*spacing;
    gp.updateMatrixWorld();

  gp.scale.multiplyScalar(4)
  
    let action = mixer.clipAction(glb1.animations[0],clone);
    action.play();
    action.time = Math.random()
    action.timeScale = Math.random()+.1
    
  
    instanceGroup.add(gp);
    //scene.add(gp);
    //tiles.push(gp);
}*/
/*
let center = rowsize*spacing*.5;
camera.position.x += center;
camera.position.z += center;
controls.target.x += center;
controls.target.z += center;*/
