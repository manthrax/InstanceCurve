import *as THREE from "three"
import {InstancedFlow} from '../three.js/examples/jsm/modifiers/CurveModifier.js'
//three/addons/modifiers/CurveModifier.js';
export class MeshPath {
    constructor({scene,geometry,material}) {

    let random = Alea(1234);
        
	let randomDirection=(v)=>{

		// https://mathworld.wolfram.com/SpherePointPicking.html

		const theta = random() * Math.PI * 2;
		const u = random() * 2 - 1;
		const c = Math.sqrt( 1 - u * u );

		v.x = c * Math.cos( theta );
		v.y = u;
		v.z = c * Math.sin( theta );

		return v;

	}

//Create a closed wavey loop

let start = new THREE.Vector3(0,0,0);
let position = new THREE.Vector3(0,0,0);
let direction = randomDirection(new THREE.Vector3()).multiplyScalar(50);
let pts=[];
for (let i = 0; i < 15; i++) {
    let warp=i/30;
    let next = randomDirection(new THREE.Vector3()).multiplyScalar(10).add(direction).add(position);
    
    direction.copy(next).sub(position).setLength(20);
    next.copy(position).add(direction);
    
    let dstart = direction.copy(start).sub(next);
    dstart.multiplyScalar(warp);
    next.add(dstart);
        
    position.copy(next);
    pts.push(next.clone());
}
/*
    let pts = [new THREE.Vector3(-10,0,10), new THREE.Vector3(-5,5,5), new THREE.Vector3(0,0,0), new THREE.Vector3(5,-5,5), new THREE.Vector3(10,0,10)]
for (let i = 0; i < 30; i++) {
    let p = new THREE.Vector3().randomDirection().multiplyScalar(50)
    p.y *= .25;
    pts.push(p)
}
*/
        

const curve = new THREE.CatmullRomCurve3(pts);
const points = curve.getPoints(100);
const geometryL = new THREE.BufferGeometry().setFromPoints(points);
const materialL = new THREE.LineBasicMaterial({
    color: 0xff0000
});

const boxMaterial = new THREE.MeshStandardMaterial({
    color: 0x99ffff
});
// Create the final object to add to the scene
const curveObject = new THREE.Line(geometryL,materialL);
//scene.add(curveObject)


        
   geometry = geometry || new THREE.TorusKnotGeometry(1.5,.15);
     let  instanceCount=100;
     material = material || new THREE.MeshStandardMaterial({
            metalness: .99,
            roughness: .01,
            //map: tex //        color: 0x99ffff
        })

    //    geometry.scale(.15, .15, .15);

        const numberOfInstances = instanceCount;
        let curveHandles = this.curveHandles = []

        let boxGeometry = new THREE.BoxGeometry();
        let curves = this.curves = [pts].map(function(curvePoints) {

            const curveVertices = curvePoints.map(function(handlePos) {

                const handle = new THREE.Mesh(boxGeometry,boxMaterial);
                handle.position.copy(handlePos);
                curveHandles.push(handle);
                scene.add(handle);
                return handle.position;

            });

            const curve = new THREE.CatmullRomCurve3(curveVertices);
            
            curve.curveType = 'centripetal';
            curve.closed = true;

            const points = curve.getPoints(50);
            const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({
                color: 0x00ff00
            }));

            //scene.add(line);

            return {
                curve,
                line
            };

        });

        let flow = this.flow = new InstancedFlow(numberOfInstances,curves.length,geometry,material);
        //flow.splineTexure.magFilter=THREE.LinearFilter;
        curves.forEach(function({curve}, i) {

            flow.updateCurve(i, curve);

        });
        scene.add(flow.object3D);

        for (let i = 0; i < numberOfInstances; i++) {

            const curveIndex = 0;
            //i % curves.length;
            flow.setCurve(i, curveIndex);
            flow.moveIndividualAlongCurve(i, (i * 1. / numberOfInstances));
            flow.object3D.setColorAt(i, new THREE.Color().setHSL(Math.random(),1,.5));//0xffffff * Math.random()));

        }
    }
}
export default function Alea(seed) {
    function Mash() {
        let n = 0xefc8249d;

        return function(data) {
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

    return function() {
        let t = 2091639 * s0 + s2 * 2.3283064365386963e-10; // 2^-32
        s0 = s1;
        s1 = s2;
        return s2 = t - (s2 = t | 0);
    };
}