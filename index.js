import*as renderer3 from './renderer3.js'
let {THREE, scene, camera, controls, renderer, dirLight} = renderer3;
let tick = 0
import {GUI} from 'three/addons/libs/lil-gui.module.min.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';

let gui = new GUI();

let onWindowResize = (event)=>{
    let width = window.innerWidth;
    let height = window.innerHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

onWindowResize();
window.addEventListener("resize", onWindowResize, false);

import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js"
import {MeshoptDecoder} from "three/addons/libs/meshopt_decoder.module.js";
let mixer = new THREE.AnimationMixer();
let loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

let glb = await loader.loadAsync('./parts.glb')

let frameTasks = []

let tex = await (new THREE.TextureLoader()).loadAsync("../art/twogoats.png");

import {MeshPath} from "./MeshPath.js"
let m = glb.scene.children[7]
m.geometry.rotateZ(Math.PI*-.5)
let meshPath = new MeshPath({
    scene,
    geometry:m.geometry,
    material:m.material
})
frameTasks.push(()=>{
    let tnow = performance.now() / 4000;
    let snow = Math.abs(Math.sin(tnow));
    meshPath.flow.moveAlongCurve(0.0002 * snow);
}
)

//editing:

const ACTION_SELECT = 1
  , ACTION_NONE = 0;
let action = ACTION_NONE;
const curveHandles = meshPath.curveHandles;
// [];
const rayCaster = new THREE.Raycaster()
const mouse = new THREE.Vector2();

let control = new TransformControls(camera,renderer.domElement);
//control.addEventListener( 'dragging-changed', function ( event ) {

control.addEventListener('objectChange', function(event) {

    if (!event.value) {

        meshPath.curves.forEach(function({curve, line}, i) {

            const points = curve.getPoints(50);
            line.geometry.setFromPoints(points);
            meshPath.flow.updateCurve(i, curve);

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
        scene.add(control);
    }else if(underMouse){
        scene.attach(control.object);
        scene.remove(control)
    }
}

function onPointerUp(event) {

    controls.enabled = true;
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);

renderer.domElement.addEventListener('pointerup', onPointerUp);

frameTasks.push(()=>{

    if (action === ACTION_SELECT) {
        action = ACTION_NONE;

    }
    controls.enabled = !control.dragging

}
)
camera.position.copy({x: -2.9792360807388114, y: 21.437020914188018, z: -3.430905503015784})
controls.target.copy( {x: -4.806586624771589, y: 0.49999999999999417, z: -3.940806163796212})
const updateAndDraw = ()=>{
    tick++
    requestAnimationFrame(updateAndDraw)
    frameTasks.forEach(ft=>ft(tick));
    mixer.update(1 / 60);
    controls.update()

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
