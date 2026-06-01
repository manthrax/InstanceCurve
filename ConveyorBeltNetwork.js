import *as THREE from "three"
//import {InstancedFlow} from 'three/addons/modifiers/CurveModifier.js'
//import {InstancedFlow} from '../three.js/examples/jsm/modifiers/CurveModifier.js'
//import {InstancedFlow} from 'https://rawcdn.githack.com/Mugen87/three.js/dev78/examples/jsm/modifiers/CurveModifier.js'
//three/addons/modifiers/CurveModifier.js';
import { InstancedFlow } from './CurveModifier.js'


export class ConveyorBeltNetwork {
    constructor() {
        this.object = new THREE.Group();
        this.curves = [];
        this.flows = {};
        this.itemTypes = {};
        this.items = [];
        this.spacing = 3.; // Distance between items in world units
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

    registerItemType(type, geometry, material, bend = true) {
        this.itemTypes[type] = { geometry, material, bend };
    }

    getOrCreateFlow(type) {
        if (this.flows[type]) {
            return this.flows[type];
        }

        const typeInfo = this.itemTypes[type];
        if (!typeInfo) {
            throw new Error(`Item type "${type}" has not been registered.`);
        }

        const totalLength = this.curves.reduce((total, curve) => total + curve.worldLength, 0);
        // Pre-allocate enough instances to fully pack the belt
        const numberOfInstances = Math.ceil(totalLength / this.spacing);

        const flow = new InstancedFlow(
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
        this.items = [];
        const registeredTypes = Object.keys(this.itemTypes);
        if (registeredTypes.length === 0) return;

        const flowInstanceCounters = {};
        registeredTypes.forEach(t => {
            flowInstanceCounters[t] = 0;
        });

        this.curves.forEach((curve, curveIndex) => {
            const curveLength = curve.worldLength;
            let slotsCount = Math.floor(curveLength / this.spacing);
            for (let s = 0; s < slotsCount; s++) {
                for (let j = 0; j < registeredTypes.length; j++) {


                    // Determine item type (cycling through registered types)
                    const type = registeredTypes[j];//(curveIndex + s) % registeredTypes.length];
                    let fixed = (type === 'belt-frame') || (type === 'grill')

                    const flow = this.getOrCreateFlow(type);

                    const instanceId = flowInstanceCounters[type]++;

                    const offset = (s * this.spacing) / curveLength;

                    flow.setCurve(instanceId, curveIndex);
                    flow.offsets[instanceId] = offset;
                    flow.writeChanges(instanceId);

                    flow.object3D.setColorAt(instanceId, new THREE.Color().setHSL(fixed ? .6 : Math.random(), 0.9, 0.1));

                    this.items.push({
                        type,
                        curveIndex,
                        offset,
                        instanceId,
                        fixed
                    });
                }
            }
        });
    }

    advance(amount) {
        this.items.forEach((item, i) => {
            const curve = this.curves[item.curveIndex];
            const flow = this.flows[item.type];
            //if (item.fixed) return;
            // Advance absolute offset along the curve
            if (!item.fixed)
                item.offset += amount / curve.worldLength;

            /*
            if (item.offset > 1) {
                item.offset %= 1;
            } else if (item.offset < 0) {
                item.offset = 1.0 + (item.offset % 1);
            }
*/

            flow.offsets[item.instanceId] = item.offset;//(i * 2) / curve.worldLength;//;
            flow.writeChanges(item.instanceId);
        });
    }
    updateCurveOffsets() {
        let so = 0;
        this.curves.forEach((curve, i) => {
            curve.startOffset = so;
            so += curve.worldLength;
        })
    }
    updateCurveGeometry(curveIndex) {
        const curve = this.curves[curveIndex];
        curve.line && curve.line.geometry.setFromPoints(curve.getPoints(50));
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

    curve.curveType = 'centripetal';
    curve.closed = closed || false;

    //const points = curve.getPoints(50);
    //const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({
    //    color: 0x00ff00
    //}));

    //curve.object = curveObject;
    //curve.line = line;
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
