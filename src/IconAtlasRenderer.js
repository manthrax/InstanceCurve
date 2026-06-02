import * as THREE from 'three';

export class IconAtlasRenderer {
    constructor(renderer, environment = null) {
        this.renderer = renderer;
        this.environment = environment;
        this.icons = {}; // Map of itemType -> DataURL (png)
    }

    generateIcon(type, geometry, material) {
        if (!geometry || !material) return null;

        // Create a temporary scene
        const scene = new THREE.Scene();
        scene.background = null; // Transparent background
        if (this.environment) {
            scene.environment = this.environment;
        }

        // Add nice ambient and directional lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        dirLight.position.set(3, 5, 4);
        scene.add(dirLight);

        // Clone geometry to avoid modifying the original one
        const geomClone = geometry.clone();
        
        // Center the geometry so it fits nicely in the camera
        geomClone.computeBoundingBox();
        const box = geomClone.boundingBox;
        geomClone.center();

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z) || 1.0;

        // Create mesh
        const mesh = new THREE.Mesh(geomClone, material.clone());
        scene.add(mesh);

        // Orthographic Camera for perfect isometric view
        const d = maxDim * 0.75;
        const camera = new THREE.OrthographicCamera(-d, d, d, -d, 1, 100);
        
        // Isometric camera positioning
        camera.position.set(maxDim * 2, maxDim * 2, maxDim * 2);
        camera.lookAt(0, 0, 0);

        // Create a small RenderTarget
        const sizePX = 128;
        const renderTarget = new THREE.WebGLRenderTarget(sizePX, sizePX, {
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });

        // Set up renderer state and render
        const currentRenderTarget = this.renderer.getRenderTarget();
        this.renderer.setRenderTarget(renderTarget);
        this.renderer.clear();
        this.renderer.render(scene, camera);
        this.renderer.setRenderTarget(currentRenderTarget);

        // Read pixels
        const buffer = new Uint8Array(sizePX * sizePX * 4);
        this.renderer.readRenderTargetPixels(renderTarget, 0, 0, sizePX, sizePX, buffer);

        // Dispose temporary target
        renderTarget.dispose();

        // Create a 2D Canvas to convert pixels to DataURL
        const canvas = document.createElement('canvas');
        canvas.width = sizePX;
        canvas.height = sizePX;
        const ctx = canvas.getContext('2d');

        // Write pixels (flip Y axis as WebGL coords start from bottom-left)
        const imgData = ctx.createImageData(sizePX, sizePX);
        for (let y = 0; y < sizePX; y++) {
            for (let x = 0; x < sizePX; x++) {
                const srcIdx = ((sizePX - 1 - y) * sizePX + x) * 4;
                const destIdx = (y * sizePX + x) * 4;
                imgData.data[destIdx] = buffer[srcIdx];
                imgData.data[destIdx + 1] = buffer[srcIdx + 1];
                imgData.data[destIdx + 2] = buffer[srcIdx + 2];
                imgData.data[destIdx + 3] = buffer[srcIdx + 3];
            }
        }
        ctx.putImageData(imgData, 0, 0);

        // Save as icon DataURL
        const dataUrl = canvas.toDataURL('image/png');
        this.icons[type] = dataUrl;

        // Clean up geometries and materials
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
        } else {
            mesh.material.dispose();
        }

        return dataUrl;
    }

    getIcon(type) {
        return this.icons[type] || null;
    }
}
