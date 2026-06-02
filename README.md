# THREEJS Conveyor Belt & Inventory Simulation

An interactive 3D simulation showing how to dynamically instance, bend, and animate meshes along curve-based paths in Three.js, complete with storage containers, item inventories, and physical collision-blocking/accumulation mechanics.

Live link here: https://manthrax.github.io/InstanceCurve/index.html

![image](https://github.com/manthrax/InstanceCurve/assets/350247/697c89bd-e153-4e3c-spacial-representation)

---

## 🏗️ Simulation Architecture

This simulation is structured around three modular components:

### 1. `ConveyorBeltNetwork`
Manages the conveyor network, curve segments, and visual meshes:
* **Single Curve Rendering**: Stores a unified set of `THREE.Curve` paths and renders the visual handles/lines once, preventing duplicate visual overlays.
* **Lazy InstancedFlow Allocation**: Pre-allocates `InstancedFlow` pools on demand for registered types, optimizing GPU performance.
* **Real-Time Draggable Updates**: Integrates with `TransformControls` so modifying control handles dynamically recalculates spline textures and updates the rendering in real-time.

### 2. `ItemContainer`
Implements storage devices connected to the belts:
* **Inventory Grids**: Configured as a grid of slots (e.g. 4x4) where each cell holds up to 100 items of a type.
* **HTML 2D Inventory View**: Click a container mesh to open a glassmorphic 2D overlay showing grid contents, stack counts, and debug controls to spawn or clear items.
* **Automatic Belt Feeding/Extraction**: Belts pull item cargo out of input containers to seed the path, and deposit them into output containers at the end of the line.

### 3. Structural vs. Cargo Components
We establish a clean logical boundary between simulation components:
* **Structural Components (`isStructural: true`)**: Static system elements that build the conveyor structure itself (such as `belt-frame`, `belt`, and `grill`). They are populated directly on the paths and remain fixed.
* **Cargo Items (`isStructural: false`)**: Simulated products (such as `rope`, `cylinder`, `fins`, and `cube-bevel`) that are transported, enter/exit inventories, and collide. They start inside storage and flow dynamically.

---

## 🚦 Collision, Spacing & Blocking Dynamics

We implement precise, realistic physical accumulation:
* **Sorted Processing**: In every frame, the simulation processes cargo items front-to-back (closest to the end of the belt first).
* **Accumulation & Backup**: If the frontmost item halts (due to reaching the end of the belt without an output container, or because the output container is full), it becomes `blocked`.
* **Proximity Collision**: Subsequent items traveling behind detect the blocked item. If they fall within the physical `spacing` threshold (`3.0` units), they halt and propagate the block backward, creating a realistic, visual backup queue.

---

## ⌨️ Controls & Interaction

### 1. Viewpoint Persistency (HMR Friendly)
The camera's spatial position and target are tracked and saved to the browser's `sessionStorage` on `beforeunload` (exit/refresh). When HMR triggers or you reload, your viewpoint is perfectly restored.

### 2. Interactive Speed Control
Press the **`+`** (or `=`) and **`-`** (or `_`) keys to dynamically adjust the conveyor belt speed setting between `0.0` (fully stopped) and `1.0` (maximum speed) in steps of `0.1`.
