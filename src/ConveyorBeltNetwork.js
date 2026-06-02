import *as THREE from "three"
//import {InstancedFlow} from 'three/addons/modifiers/CurveModifier.js'
//import {InstancedFlow} from '../three.js/examples/jsm/modifiers/CurveModifier.js'
//import {InstancedFlow} from 'https://rawcdn.githack.com/Mugen87/three.js/dev78/examples/jsm/modifiers/CurveModifier.js'
//three/addons/modifiers/CurveModifier.js';
import { InstancedFlow } from './CurveModifier.js'
import { IconAtlasRenderer } from './IconAtlasRenderer.js'


export class ConveyorBeltNetwork {
    constructor() {
        this.object = new THREE.Group();
        this.curves = [];
        this.flows = {};
        this.itemTypes = {};
        this.items = [];
        this.spacing = 3.; // Distance between items in world units
        this.inputs = {};  // curveIndex -> ItemContainer
        this.outputs = {}; // curveIndex -> ItemContainer
        this.iconRenderer = null;
    }

    initIconRenderer(renderer, environment = null) {
        this.iconRenderer = new IconAtlasRenderer(renderer, environment);
        // Generate icons for any already registered cargo types
        Object.keys(this.itemTypes).forEach(type => {
            const info = this.itemTypes[type];
            if (!info.isStructural) {
                this.iconRenderer.generateIcon(type, info.geometry, info.material);
            }
        });
    }

    setInputContainer(curveIndex, container) {
        this.inputs[curveIndex] = container;
    }

    setOutputContainer(curveIndex, container) {
        this.outputs[curveIndex] = container;
    }

    setCurves(curves) {
        this.curves = curves;
        curves.forEach(curve => {
            if (curve.object) this.object.add(curve.object);
            if (curve.line) this.object.add(curve.line);
            if (curve.curveHandles) {
                curve.curveHandles.forEach(h => this.object.add(h));
            }
        });

        this.updateCurveOffsets();

        // If flows were already registered, update their curves
        Object.keys(this.flows).forEach(type => {
            const flow = this.flows[type];
            this.curves.forEach((curve, i) => {
                flow.updateCurve(i, curve);
            });
        });
    }

    registerItemType(type, geometry, material, bend = true, isStructural = false, fixed = false, tint = null) {
        this.itemTypes[type] = { geometry, material, bend, isStructural, fixed, tint };
        if (this.iconRenderer && !isStructural) {
            this.iconRenderer.generateIcon(type, geometry, material);
        }
    }

    getOrCreateFlow(type) {
        // Pre-allocate enough instances to fully pack the belt, matching the per-curve ceil logic
        const numberOfInstances = this.curves.reduce((total, curve) => total + Math.ceil(curve.worldLength / this.spacing), 0);

        let flow = this.flows[type];
        if (flow) {
            if (flow.offsets.length >= numberOfInstances) {
                return flow;
            }
            // Existing flow is too small (e.g. curve was dragged and became longer). Re-allocate it!
            this.object.remove(flow.object3D);
            delete this.flows[type];
        }

        const typeInfo = this.itemTypes[type];
        if (!typeInfo) {
            throw new Error(`Item type "${type}" has not been registered.`);
        }

        flow = new InstancedFlow(
            numberOfInstances,
            this.curves.length,
            typeInfo.geometry,
            typeInfo.material,
            typeInfo.bend
        );

        this.curves.forEach((curve, i) => {
            flow.updateCurve(i, curve);
        });
        flow.object3D.castShadow = flow.object3D.receiveShadow = true;
        this.object.add(flow.object3D);
        this.flows[type] = flow;
        return flow;
    }

    populateBelt() {
        // Save currently active cargo items (the items that are already traveling)
        const activeCargo = this.items.filter(item => item.offset >= 0 && !this.itemTypes[item.type].isStructural);

        this.items = [];
        const registeredTypes = Object.keys(this.itemTypes);
        if (registeredTypes.length === 0) return;

        const flowInstanceCounters = {};
        registeredTypes.forEach(t => {
            flowInstanceCounters[t] = 0;
        });

        // 1. Populate all structural elements (belt, belt-frame, grill) along the curves
        this.curves.forEach((curve, curveIndex) => {
            const curveLength = curve.worldLength;
            const startMargin = curve.closed ? 0.0 : 1.5 / curveLength;
            const endMargin = curve.closed ? 1.0 : 1.0 - (2.5 / curveLength);
            let slotsCount = Math.ceil(curveLength / this.spacing);

            for (let s = 0; s < slotsCount; s++) {
                for (let j = 0; j < registeredTypes.length; j++) {
                    const type = registeredTypes[j];
                    const typeInfo = this.itemTypes[type];
                    const isStructural = typeInfo.isStructural;

                    if (isStructural) {
                        const flow = this.getOrCreateFlow(type);
                        const instanceId = flowInstanceCounters[type]++;
                        const offset = (s * this.spacing) / curveLength;
                        const inRange = curve.closed || (offset >= startMargin && offset <= endMargin);
                        const shouldSpawn = inRange && ((type !== 'belt-frame' && type !== 'grill') || (s % 2 === 0));

                        if (shouldSpawn) {
                            flow.setCurve(instanceId, curveIndex);
                            flow.offsets[instanceId] = offset;
                            flow.writeChanges(instanceId);

                            if (type === 'belt') {
                                const isEven = (s % 2 === 0);
                                flow.object3D.setColorAt(instanceId, new THREE.Color(isEven ? '#ffcc00' : '#333333'));
                            } else {
                                flow.object3D.setColorAt(instanceId, new THREE.Color('#222222'));
                            }

                            this.items.push({
                                type,
                                curveIndex,
                                offset,
                                instanceId,
                                fixed: typeInfo.fixed
                            });
                        } else {
                            flow.offsets[instanceId] = -9999.0;
                            flow.writeChanges(instanceId);

                            this.items.push({
                                type,
                                curveIndex,
                                offset: -1.0,
                                instanceId,
                                fixed: typeInfo.fixed
                            });
                        }
                    }
                }
            }
        });

        // 2. Restore and re-activate all previously active traveling cargo items
        activeCargo.forEach(cargo => {
            const flow = this.getOrCreateFlow(cargo.type);
            const instanceId = flowInstanceCounters[cargo.type]++;

            flow.setCurve(instanceId, cargo.curveIndex);
            flow.offsets[instanceId] = cargo.offset;

            // Preserve or re-initialize scale & rotation
            flow.scales[instanceId] = new THREE.Vector3(1.0, 1.0, 1.0);
            const euler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
            flow.rotations[instanceId] = new THREE.Matrix4().makeRotationFromEuler(euler);

            flow.writeChanges(instanceId);

            // Apply material tint color
            const typeInfo = this.itemTypes[cargo.type];
            const tintColor = typeInfo.tint ? new THREE.Color(typeInfo.tint) : new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
            flow.object3D.setColorAt(instanceId, tintColor);

            this.items.push({
                type: cargo.type,
                curveIndex: cargo.curveIndex,
                offset: cargo.offset,
                instanceId,
                fixed: false
            });
        });

        // 3. Spawns initial cargo on closed loops only at game startup (activeCargo is empty)
        if (activeCargo.length === 0) {
            const cargoTypes = registeredTypes.filter(t => !this.itemTypes[t].isStructural);
            this.curves.forEach((curve, curveIndex) => {
                if (curve.closed) {
                    const curveLength = curve.worldLength;
                    let slotsCount = Math.ceil(curveLength / this.spacing);
                    for (let s = 0; s < slotsCount; s++) {
                        const activeCargoType = cargoTypes.length > 0 ? cargoTypes[s % cargoTypes.length] : null;
                        if (activeCargoType) {
                            const flow = this.getOrCreateFlow(activeCargoType);
                            const instanceId = flowInstanceCounters[activeCargoType]++;
                            const offset = (s * this.spacing) / curveLength;

                            flow.setCurve(instanceId, curveIndex);
                            flow.offsets[instanceId] = offset;
                            flow.scales[instanceId] = new THREE.Vector3(1.0, 1.0, 1.0);
                            const euler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
                            flow.rotations[instanceId] = new THREE.Matrix4().makeRotationFromEuler(euler);

                            flow.writeChanges(instanceId);

                            const typeInfo = this.itemTypes[activeCargoType];
                            const tintColor = typeInfo.tint ? new THREE.Color(typeInfo.tint) : new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
                            flow.object3D.setColorAt(instanceId, tintColor);

                            this.items.push({
                                type: activeCargoType,
                                curveIndex,
                                offset,
                                instanceId,
                                fixed: false
                            });
                        }
                    }
                }
            });
        }

        // 4. Fill the remaining capacity with inactive cargo items so they are available for dynamic spawning
        const cargoTypes = registeredTypes.filter(t => !this.itemTypes[t].isStructural);
        this.curves.forEach((curve, curveIndex) => {
            const curveInstancesCount = Math.ceil(curve.worldLength / this.spacing);
            cargoTypes.forEach(type => {
                const flow = this.getOrCreateFlow(type);
                for (let i = 0; i < curveInstancesCount; i++) {
                    const instanceId = flowInstanceCounters[type]++;
                    if (instanceId < flow.offsets.length) {
                        flow.offsets[instanceId] = -9999.0;
                        flow.scales[instanceId] = new THREE.Vector3(1.0, 1.0, 1.0);
                        const euler = new THREE.Euler(0, Math.random() * Math.PI * 2, 0);
                        flow.rotations[instanceId] = new THREE.Matrix4().makeRotationFromEuler(euler);
                        flow.writeChanges(instanceId);

                        this.items.push({
                            type,
                            curveIndex,
                            offset: -1.0,
                            instanceId,
                            fixed: false
                        });
                    }
                }
            });
        });

        // Clean up and deactivate any unused instances remaining in the pools (e.g. if the curves shrank)
        Object.keys(this.flows).forEach(type => {
            const flow = this.flows[type];
            const activeCount = flowInstanceCounters[type] || 0;
            const totalCount = flow.offsets.length;
            for (let id = activeCount; id < totalCount; id++) {
                flow.offsets[id] = -9999.0;
                flow.writeChanges(id);
            }
        });
    }

    advance(amount) {
        // Fixed items do not move, but we still write their changes once
        this.items.forEach(item => {
            if (item.fixed) {
                const flow = this.flows[item.type];
                flow.offsets[item.instanceId] = item.offset;
                flow.writeChanges(item.instanceId);
            }
        });

        // Process moving items curve-by-curve
        this.curves.forEach((curve, curveIndex) => {
            const startMargin = curve.closed ? 0.0 : 1.5 / curve.worldLength;
            const endMargin = curve.closed ? 1.0 : 1.0 - 4 / curve.worldLength;
            const spacingOffset = this.spacing / curve.worldLength;

            // 1. Process structural moving elements (like the belt track surface)
            // They loop infinitely and do not collide, block, or trigger inventories
            const structuralMoving = this.items.filter(item => !item.fixed && item.curveIndex === curveIndex && item.offset >= 0 && this.itemTypes[item.type].isStructural);

            const structStartMargin = curve.closed ? 0.0 : 1.0 / curve.worldLength;
            const structEndMargin = curve.closed ? 1.0 : 1.0 - 4.0 / curve.worldLength;

            structuralMoving.forEach(item => {
                const flow = this.flows[item.type];
                item.offset += amount / curve.worldLength;
                if (item.offset > 1.0) {
                    item.offset = item.offset % 1.0;
                } else if (item.offset < 0.0) {
                    item.offset = 1.0 + (item.offset % 1.0);
                }

                if (!curve.closed && (item.offset < structStartMargin || item.offset > structEndMargin)) {
                    flow.offsets[item.instanceId] = -9999.0;
                } else {
                    flow.offsets[item.instanceId] = item.offset;
                }
                flow.writeChanges(item.instanceId);
            });

            // 2. Process cargo items
            const cargoMoving = this.items.filter(item => !item.fixed && item.curveIndex === curveIndex && item.offset >= 0 && !this.itemTypes[item.type].isStructural);

            if (curve.closed) {
                // For closed loops, cargo items flow endlessly and wrap around modulo 1.0
                cargoMoving.forEach(item => {
                    const flow = this.flows[item.type];
                    item.offset += amount / curve.worldLength;
                    if (item.offset > 1.0) {
                        item.offset = item.offset % 1.0;
                    } else if (item.offset < 0.0) {
                        item.offset = 1.0 + (item.offset % 1.0);
                    }
                    flow.offsets[item.instanceId] = item.offset;
                    flow.writeChanges(item.instanceId);
                });
            } else {
                // For open curves: subject to boundary margins, collision-blocking, and container entries
                // Sort them descending by offset (closest to 1.0/end of the belt first)
                cargoMoving.sort((a, b) => b.offset - a.offset);

                // Keep track of the offset of the item immediately in front
                let nextItemOffset = endMargin; // The end of the belt acts as a boundary

                cargoMoving.forEach((item, index) => {
                    const flow = this.flows[item.type];
                    const isFrontmost = (index === 0);

                    if (isFrontmost) {
                        const outputContainer = this.outputs[curveIndex];
                        if (item.offset >= endMargin - 0.01) {
                            // At the end of the belt: attempt to enter output container
                            if (outputContainer) {
                                if (outputContainer.canAccept(item.type)) {
                                    outputContainer.addItem(item.type, 1);
                                    // Recycle/deactivate the item by setting its offset to -1 (off-screen)
                                    item.offset = -1.0;
                                    flow.offsets[item.instanceId] = -9999.0; // Place far away
                                    flow.writeChanges(item.instanceId);
                                    return;
                                }
                            }
                            // If no output container, or container is full: block at the end
                            item.offset = endMargin;
                            nextItemOffset = endMargin;
                        } else {
                            // Advance normally up to the end of the belt
                            const targetOffset = item.offset + amount / curve.worldLength;
                            item.offset = Math.min(endMargin, targetOffset);
                            nextItemOffset = item.offset;
                        }
                    } else {
                        // Not frontmost: check spacing collision with the item in front
                        const maxAllowedOffset = nextItemOffset - spacingOffset;
                        if (item.offset < maxAllowedOffset) {
                            // There is space to advance
                            const targetOffset = item.offset + amount / curve.worldLength;
                            item.offset = Math.min(maxAllowedOffset, targetOffset);
                        } else {
                            // Blocked by the item in front
                            item.offset = Math.max(startMargin, maxAllowedOffset);
                        }
                        nextItemOffset = item.offset;
                    }

                    // Write changes
                    flow.offsets[item.instanceId] = item.offset;
                    flow.writeChanges(item.instanceId);
                });
            }

            // Automatic Cargo Spawning/Extraction from Input Container
            const inputContainer = this.inputs[curveIndex];
            if (inputContainer) {
                // Check if the start of the belt is clear of cargo items
                const firstItemOffset = cargoMoving.length > 0 ? cargoMoving[cargoMoving.length - 1].offset : endMargin;
                if (firstItemOffset >= startMargin + spacingOffset) {
                    // Start of the belt is clear! Try to pull an item from the input container
                    let typeToSpawn = null;
                    for (let r = 0; r < inputContainer.rows; r++) {
                        for (let c = 0; c < inputContainer.cols; c++) {
                            const stack = inputContainer.grid[r][c];
                            if (stack && stack.count > 0) {
                                typeToSpawn = stack.type;
                                break;
                            }
                        }
                        if (typeToSpawn) break;
                    }

                    if (typeToSpawn) {
                        // Find an inactive moving cargo item on this curve to reuse
                        const reusableItem = this.items.find(item => !item.fixed && item.curveIndex === curveIndex && item.offset < 0 && item.type === typeToSpawn);
                        if (reusableItem) {
                            // Deduct item from container
                            inputContainer.removeItem(typeToSpawn, 1);

                            // Spawn/activate the item at the start of the belt
                            reusableItem.offset = startMargin;
                            const flow = this.flows[typeToSpawn];
                            flow.setCurve(reusableItem.instanceId, curveIndex);
                            flow.offsets[reusableItem.instanceId] = startMargin;
                            flow.writeChanges(reusableItem.instanceId);
                        }
                    }
                }
            }
        });
    }
    updateCurveOffsets() {
        let so = 0;
        this.curves.forEach((curve, i) => {
            curve.startOffset = so;
            so += curve.worldLength;
        })
    }
    updateCurveWireframe(curveIndex) {
        const curve = this.curves[curveIndex];
        if (curve.line) {
            const numPoints = curve.points.length * 8;
            curve.line.geometry.setFromPoints(curve.getPoints(numPoints));
        }
    }
    updateCurveGeometry(curveIndex) {
        const curve = this.curves[curveIndex];
        if (curve.line) {
            const numPoints = curve.points.length * 8;
            curve.line.geometry.setFromPoints(curve.getPoints(numPoints));
        }
        curve.worldLength = curve.getLength();

        this.updateCurveOffsets();

        Object.keys(this.flows).forEach(type => {
            this.flows[type].updateCurve(curveIndex, curve);
        });
    }
}


let boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x99ffff,
    depthTest: false,
    transparent: true,
    opacity: .1
});
let boxGeometry = new THREE.SphereGeometry(1, 12, 12);

export function generateCurve(pts, sampleCount = 100, closed = false) {
    /*
        if (0) {
            const curve = new THREE.CatmullRomCurve3(pts);
            const points = curve.getPoints(sampleCount);
    
            const geometryL = new THREE.BufferGeometry().setFromPoints(points);
            const materialL = new THREE.LineBasicMaterial({
                color: 0xff0000
            });
    
            // Create the final object to add to the scene
            const curveObject = new THREE.Line(geometryL, materialL);
        }
    */
    let curveHandles = []

    if (!boxMaterial) {

        boxMaterial = new THREE.MeshStandardMaterial({
            color: 0x99ffff,
            depthTest: false,
            transparent: true,
            opacity: .1
        });
        boxGeometry = new THREE.SphereGeometry(1, 12, 12);

    }
    const curvePoints = pts;
    const curveVertices = curvePoints.map(function (handlePos) {

        const handle = new THREE.Mesh(boxGeometry, boxMaterial);
        handle.position.copy(handlePos);
        curveHandles.push(handle);
        return handle.position;

    });

    const curve = new THREE.CatmullRomCurve3(curveVertices);

    curve.curveType = 'catmullrom' // 'centripetal';
    curve.closed = closed || false;

    const numPoints = curve.points.length * 8;
    const points = curve.getPoints(numPoints);
    const materialL = new THREE.LineBasicMaterial({
        color: 0x77aaff,
        transparent: true,
        opacity: 0.5
    });
    const line = curve.closed
        ? new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), materialL)
        : new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), materialL);

    line.visible = false;
    curve.line = line;
    curve.curveHandles = curveHandles;
    curve.worldLength = curve.getLength();
    return curve;
}

export default function Alea(seed) {
    function Mash() {
        let n = 0xefc8249d;

        return function (data) {
            data = data.toString();
            for (let i = 0; i < data.length; i++) {
                n += data.charCodeAt(i);
                let h = 0.02519603282416938 * n;
                n = h >>> 0;
                h -= n;
                h *= n;
                n = h >>> 0;
                h -= n;
                n += h * 0x100000000; // 2^32
            }
            return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
        };
    }

    let m = Mash(), s0 = m(" "), s1 = m(" "), s2 = m(" ");
    s0 -= m(seed); if (s0 < 0) { s0 += 1; }
    s1 -= m(seed); if (s1 < 0) { s1 += 1; }
    s2 -= m(seed); if (s2 < 0) { s2 += 1; }

    return function () {
        let t = 2091639 * s0 + s2 * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        return s2 = t - (s2 = t | 0);
    };
}
