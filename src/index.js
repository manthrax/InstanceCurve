import *as renderer3 from './renderer3.js'
let { THREE, scene, camera, controls, renderer, dirLight } = renderer3;
let tick = 0;
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
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
import { ItemContainer } from './ItemContainer.js';


let env = new Environment(renderer, scene, camera);

window.addEventListener('env-loaded', (e) => {
    const envMap = e.detail;
    if (window.beltNetwork) {
        window.beltNetwork.initIconRenderer(renderer, envMap);
        if (window.allContainers) {
            window.allContainers.forEach(c => c.refreshInventoryUI());
        }
    }
});


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
window.beltNetwork = beltNetwork;
beltNetwork.initIconRenderer(renderer);

// Set up the single conveyor belt network

// Set curves in the network
const curves = paths.map((pathPts, i) => generateCurve(pathPts, 100, closed[i]));
beltNetwork.setCurves(curves);



let addObj = ({ name = '', meshName = '', px, py = 0, pz, sx, sy, sz, scale, rx = 0, ry = 0, rz = 0, len = 1, fixed = false, bend = true, isStructural = false, tint = null }) => {
    const lookupName = meshName || name;
    let o = glb.scene.getObjectByName(lookupName);
    if (!o) {
        console.error(`Mesh "${lookupName}" not found in GLB.`);
        return;
    }

    // Clone geometry and material to allow independent reuse and decoupling
    let geom = o.geometry.clone();
    let mat = o.material.clone();

    rx && geom.rotateX(rx * Math.PI / 180)
    ry && geom.rotateY(ry * Math.PI / 180)
    rz && geom.rotateZ(rz * Math.PI / 180)

    if (scale !== undefined) {
        if (typeof scale === 'number') {
            geom.scale(scale, scale, scale);
        } else if (Array.isArray(scale)) {
            geom.scale(scale[0] || 1, scale[1] || 1, scale[2] || 1);
        } else if (scale.isVector3) {
            geom.scale(scale.x, scale.y, scale.z);
        }
    } else {
        geom.scale(sx || 1, sy || 1, sz || 1);
    }

    geom.translate(px || 0, py || 0, pz || 0)
    beltNetwork.registerItemType(name, geom, mat, bend, isStructural, fixed, tint);
}
addObj({ name: 'belt-frame', bend: true, fixed: true, py: -1, px: 0, rz: 180, isStructural: true })
addObj({ name: 'belt', bend: true, fixed: false, py: -1, rz: 180, isStructural: true })
addObj({ name: 'grill', bend: false, fixed: true, py: -1., px: 1.6, rz: 180, isStructural: true })
addObj({ name: 'fins', bend: false, py: -2, rz: 90, tint: 'white' })
addObj({ name: 'rope', bend: true, py: -2, rz: 90, tint: 'white' })
addObj({ name: 'cylinder', bend: false, py: -2, rz: 90, tint: 'white' })
addObj({ name: 'cube-bevel', bend: false, py: -2, tint: 'white' })


// Populate the conveyor belt automatically with evenly spaced items
beltNetwork.populateBelt();

// Add the visual network group to the scene
scene.add(beltNetwork.object);

// Initialize list for container raycast tracking
window.allContainers = [];

// Initialize Player Inventory (4x4)
window.playerInventory = new ItemContainer({
    name: "Player Inventory",
    geometry: null,
    material: null,
    rows: 4,
    cols: 4
});
// Add starting items to the player inventory
window.playerInventory.addItem('rope', 20);
window.playerInventory.addItem('cylinder', 10);
window.playerInventory.addItem('cube-bevel', 15);

// Get the item-container geometry/material from the glb scene
let containerObj = glb.scene.getObjectByName('item-container');
if (!containerObj) {
    console.warn("Mesh 'item-container' not found in GLB. Falling back to 'cube-bevel'.");
    containerObj = glb.scene.getObjectByName('cube-bevel');
}

// Dynamically auto-attach containers to all open (non-closed) curves in the network
beltNetwork.curves.forEach((curve, i) => {
    if (!curve.closed) {
        const startPoint = curve.getPointAt(0.0);
        const endPoint = curve.getPointAt(1.0);

        const inputContainer = new ItemContainer({
            name: `Input Storage ${i + 1}`,
            geometry: containerObj.geometry.clone(),
            material: containerObj.material,
            position: new THREE.Vector3(startPoint.x, startPoint.y + 1, startPoint.z)
        });

        const outputContainer = new ItemContainer({
            name: `Output Storage ${i + 1}`,
            geometry: containerObj.geometry.clone(),
            material: containerObj.material,
            position: new THREE.Vector3(endPoint.x, endPoint.y + 1, endPoint.z)
        });

        // Partially fill input container with a random assortment of registered items
        const types = ['rope', 'cylinder', 'cube-bevel', 'fins'];
        types.forEach(t => {
            if (Math.random() > 0.2) {
                const count = Math.floor(Math.random() * 40) + 10;
                inputContainer.addItem(t, count);
            }
        });

        // Register containers in the scene
        scene.add(inputContainer.object3D);
        scene.add(outputContainer.object3D);

        // Connect the containers to the belt network
        beltNetwork.setInputContainer(i, inputContainer);
        beltNetwork.setOutputContainer(i, outputContainer);

        // Save references for selection Raycasting
        window.allContainers.push(inputContainer, outputContainer);
    }
});

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

// Custom Invisible Drag-Transformer Controls
const curveHandles = beltNetwork.curves.reduce((acc, cur) => acc.concat(cur.curveHandles), []);
const rayCaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let selectedNode = null;
let isDraggingNode = false;
let isCtrlDragging = false;
const dragPlane = new THREE.Plane();
const dragIntersection = new THREE.Vector3();
const dragStartOffset = new THREE.Vector3();

function selectNode(node) {
    if (selectedNode) {
        selectedNode.scale.set(1.0, 1.0, 1.0);
    }
    selectedNode = node;
    if (selectedNode) {
        selectedNode.scale.set(1.5, 1.5, 1.5);
    }
}

function deselectNode() {
    if (selectedNode) {
        selectedNode.scale.set(1.0, 1.0, 1.0);
        selectedNode = null;
    }
}

function getCurveHandleUnderMouse() {
    rayCaster.setFromCamera(mouse, camera);
    const intersects = rayCaster.intersectObjects(curveHandles, false);
    if (intersects.length)
        return intersects[0];
}

function onPointerDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Right click clears selection
    if (event.button === 2) {
        deselectNode();
        if (isDraggingNode) {
            isDraggingNode = false;
            controls.enabled = true;
        }
        return;
    }

    if (event.button !== 0) return; // Only process left click

    // Check if clicking on any registered ItemContainer
    rayCaster.setFromCamera(mouse, camera);
    const containerMeshes = (window.allContainers || []).map(c => c.object3D);
    const containerIntersects = rayCaster.intersectObjects(containerMeshes, false);
    if (containerIntersects.length > 0) {
        const container = containerIntersects[0].object.userData.container;
        if (container) {
            container.showInventoryView();
            return;
        }
    } else {
        // Clicked outside: close open inventories
        if (window.activeContainerInventory) {
            window.activeContainerInventory.closeInventoryView();
            if (window.playerInventory) {
                window.playerInventory.closeInventoryView();
            }
        }
    }

    let underMouse = getCurveHandleUnderMouse();
    if (underMouse) {
        const clickedNode = underMouse.object;
        /*if (selectedNode === clickedNode) {
            // Clicking selected node deselects it
            deselectNode();
            isDraggingNode = false;
        } else */
        {
            // Select node and start dragging
            selectNode(clickedNode);
            isDraggingNode = true;
            isCtrlDragging = event.ctrlKey;
            controls.enabled = false; // Disable orbit controls

            // Make the preview lines visible during drag
            beltNetwork.curves.forEach(curve => {
                if (curve.line) curve.line.visible = true;
            });

            // Initialize plane
            if (isCtrlDragging) {
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                camDir.y = 0;
                camDir.normalize();
                const planeNormal = new THREE.Vector3(-camDir.x, 0, -camDir.z).normalize();
                dragPlane.setFromNormalAndCoplanarPoint(planeNormal, selectedNode.position);
            } else {
                dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), selectedNode.position);
            }

            if (rayCaster.ray.intersectPlane(dragPlane, dragIntersection)) {
                dragStartOffset.copy(selectedNode.position).sub(dragIntersection);
            }
        }
    }
}

function onPointerMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (!isDraggingNode || !selectedNode) return;

    rayCaster.setFromCamera(mouse, camera);
    const isCtrl = event.ctrlKey;

    if (isCtrl !== isCtrlDragging) {
        // State transitioned during drag! Update plane and offset to prevent jumps.
        isCtrlDragging = isCtrl;
        if (isCtrlDragging) {
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            camDir.y = 0;
            camDir.normalize();
            const planeNormal = new THREE.Vector3(-camDir.x, 0, -camDir.z).normalize();
            dragPlane.setFromNormalAndCoplanarPoint(planeNormal, selectedNode.position);
        } else {
            dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), selectedNode.position);
        }
        if (rayCaster.ray.intersectPlane(dragPlane, dragIntersection)) {
            dragStartOffset.copy(selectedNode.position).sub(dragIntersection);
        }
    }

    if (rayCaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        if (isCtrlDragging) {
            selectedNode.position.y = dragIntersection.y + dragStartOffset.y;
        } else {
            selectedNode.position.x = dragIntersection.x + dragStartOffset.x;
            selectedNode.position.z = dragIntersection.z + dragStartOffset.z;
        }

        beltNetwork.curves.forEach(function (curve, i) {
            beltNetwork.updateCurveWireframe(i);
        });
    }
}

function onPointerUp(event) {
    if (isDraggingNode && selectedNode) {
        // Perform the heavy recompute and repopulation exactly once when the drag operation completes!
        beltNetwork.curves.forEach(function (curve, i) {
            beltNetwork.updateCurveGeometry(i);
        });
        beltNetwork.populateBelt();
    }
    // Hide the preview lines when the drag operation completes
    beltNetwork.curves.forEach(curve => {
        if (curve.line) curve.line.visible = false;
    });
    isDraggingNode = false;
    controls.enabled = true; // Re-enable orbit controls
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault()); // Prevent right-click context menu
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
    dirLight.position.sub(dirLight.target.position);
    dirLight.target.position.copy(controls.target);
    dirLight.target.updateMatrixWorld(true)
    dirLight.position.add(dirLight.target.position);

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
