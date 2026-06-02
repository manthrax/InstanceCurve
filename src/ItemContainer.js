import * as THREE from 'three';

export class ItemContainer {
    constructor({ name, geometry, material, rows = 4, cols = 4, position = new THREE.Vector3() }) {
        this.name = name;
        this.rows = rows;
        this.cols = cols;
        this.position = position.clone();

        // Initialize grid: rows x cols. Each slot can be null or { type, count }
        this.grid = Array.from({ length: rows }, () => Array(cols).fill(null));
        this.items = []; // Flat list of item references for convenience

        // Create the InstancedMesh for the container body if geometry and material are provided
        if (geometry && material) {
            this.object3D = new THREE.InstancedMesh(geometry, material, 1);
            const matrix = new THREE.Matrix4().makeTranslation(this.position.x, this.position.y, this.position.z);
            this.object3D.setMatrixAt(0, matrix);
            this.object3D.instanceMatrix.needsUpdate = true;

            // Associate back-reference for raycast selection
            this.object3D.userData = { container: this };
        } else {
            this.object3D = null;
        }

        this.inventoryEl = null;
    }

    canAccept(type, amount = 1) {
        // First check if we can add to an existing stack of the same type with space (< 100)
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const stack = this.grid[r][c];
                if (stack && stack.type === type && stack.count + amount <= 100) {
                    return true;
                }
            }
        }

        // If not, check if there is an empty slot
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === null) {
                    return true;
                }
            }
        }

        return false;
    }

    addItem(type, amount = 1) {
        // 1. Try to add to an existing stack
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const stack = this.grid[r][c];
                if (stack && stack.type === type && stack.count + amount <= 100) {
                    stack.count += amount;
                    this.updateFlatItemsList();
                    this.refreshInventoryUI();
                    return true;
                }
            }
        }

        // 2. Try to place in a new empty slot
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === null) {
                    this.grid[r][c] = { type, count: amount, location: [r, c] };
                    this.updateFlatItemsList();
                    this.refreshInventoryUI();
                    return true;
                }
            }
        }

        return false; // Container is full
    }

    removeItem(type, amount = 1) {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const stack = this.grid[r][c];
                if (stack && stack.type === type) {
                    if (stack.count >= amount) {
                        stack.count -= amount;
                        if (stack.count === 0) {
                            this.grid[r][c] = null;
                        }
                        this.updateFlatItemsList();
                        this.refreshInventoryUI();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    updateFlatItemsList() {
        this.items = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== null) {
                    this.items.push(this.grid[r][c]);
                }
            }
        }
    }

    transferStack(r, c, target) {
        if (!target) return;
        const stack = this.grid[r][c];
        if (!stack) return;

        // Try to add to target
        let added = target.addItem(stack.type, stack.count);
        if (added) {
            this.grid[r][c] = null;
            this.updateFlatItemsList();
            this.refreshInventoryUI();
            target.updateFlatItemsList();
            target.refreshInventoryUI();
        }
    }

    closeInventoryView() {
        if (this.inventoryEl) {
            this.inventoryEl.remove();
            this.inventoryEl = null;
        }
        if (this === window.activeContainerInventory) {
            window.activeContainerInventory = null;
        }
    }

    showInventoryView() {
        // If not player inventory, manage active container selection
        if (this !== window.playerInventory) {
            if (window.activeContainerInventory && window.activeContainerInventory !== this) {
                window.activeContainerInventory.closeInventoryView();
            }
            window.activeContainerInventory = this;

            // Auto-open player inventory if not already open
            if (window.playerInventory && !window.playerInventory.inventoryEl) {
                window.playerInventory.showInventoryView();
            }
        }

        // Close existing inventory view first if open
        if (this.inventoryEl) {
            this.inventoryEl.remove();
        }

        // Create the container DOM element
        const containerDiv = document.createElement('div');
        containerDiv.id = `inventory-${this.name}`;
        
        const isPlayer = (this === window.playerInventory);
        containerDiv.style.cssText = `
            position: fixed;
            top: 3px;
            ${isPlayer ? 'left: 3px;' : 'right: 3px;'}
            background: rgba(10, 10, 15, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0px;
            padding: 3px;
            z-index: 10000;
            color: #eeeeee;
            font-family: 'Outfit', 'Roboto', sans-serif;
            box-shadow: 0 2px 10px 0 rgba(0, 0, 0, 0.5);
            user-select: none;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            min-width: 170px;
        `;

        this.inventoryEl = containerDiv;
        document.body.appendChild(containerDiv);

        this.refreshInventoryUI();
    }

    refreshInventoryUI() {
        if (!this.inventoryEl) return;

        // Clear and redraw
        this.inventoryEl.innerHTML = '';

        // Header Title (Acts as drag handle)
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            padding-bottom: 2px;
            cursor: grab;
        `;
        
        const title = document.createElement('h4');
        title.innerText = this.name;
        title.style.cssText = `
            margin: 0;
            color: #77aaff;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.5px;
        `;
        header.appendChild(title);

        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.5);
            font-size: 10px;
            cursor: pointer;
            padding: 0px 2px;
            transition: color 0.2s;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.color = '#ff5555';
        closeBtn.onmouseleave = () => closeBtn.style.color = 'rgba(255, 255, 255, 0.5)';
        closeBtn.onclick = () => {
            const isPlayer = (this === window.playerInventory);
            this.closeInventoryView();
            if (!isPlayer && window.playerInventory) {
                window.playerInventory.closeInventoryView();
            }
        };
        header.appendChild(closeBtn);
        this.inventoryEl.appendChild(header);

        // Setup Drag listeners
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;
        const containerDiv = this.inventoryEl;

        const onDragStart = (e) => {
            if (e.target === closeBtn) return;
            isDragging = true;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            offsetX = clientX - containerDiv.offsetLeft;
            offsetY = clientY - containerDiv.offsetTop;
            header.style.cursor = 'grabbing';
        };

        const onDrag = (e) => {
            if (!isDragging) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            containerDiv.style.left = `${clientX - offsetX}px`;
            containerDiv.style.top = `${clientY - offsetY}px`;
            containerDiv.style.transform = 'none';
        };

        const onDragEnd = () => {
            isDragging = false;
            header.style.cursor = 'grab';
        };

        header.addEventListener('mousedown', onDragStart);
        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', onDragEnd);

        header.addEventListener('touchstart', onDragStart);
        window.addEventListener('touchmove', onDrag);
        window.addEventListener('touchend', onDragEnd);

        // 2D Grid Representation
        const gridContainer = document.createElement('div');
        gridContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(${this.cols}, 40px);
            grid-template-rows: repeat(${this.rows}, 40px);
            gap: 2px;
            justify-content: center;
        `;

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const slot = document.createElement('div');
                slot.style.cssText = `
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.04);
                    border-radius: 0px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    font-size: 9px;
                    position: relative;
                    overflow: hidden;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    transition: border-color 0.2s, background-color 0.2s;
                `;

                slot.onmouseenter = () => {
                    slot.style.borderColor = 'rgba(119, 170, 255, 0.4)';
                    slot.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                };
                slot.onmouseleave = () => {
                    slot.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                    slot.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                };

                const stack = this.grid[r][c];
                if (stack) {
                    const iconUrl = window.beltNetwork && window.beltNetwork.iconRenderer ? window.beltNetwork.iconRenderer.getIcon(stack.type) : null;
                    if (iconUrl) {
                        const img = document.createElement('img');
                        img.src = iconUrl;
                        img.title = stack.type;
                        img.style.cssText = `
                            width: 26px;
                            height: 26px;
                            object-fit: contain;
                            pointer-events: none;
                        `;
                        slot.appendChild(img);
                    } else {
                        // Text Fallback
                        const label = document.createElement('div');
                        label.innerText = stack.type;
                        label.style.cssText = `
                            font-weight: 500;
                            text-align: center;
                            word-break: break-all;
                            padding: 1px;
                            color: #ffaa55;
                            transform: scale(0.85);
                        `;
                        slot.appendChild(label);
                    }

                    const count = document.createElement('div');
                    count.innerText = stack.count;
                    count.style.cssText = `
                        position: absolute;
                        bottom: 0px;
                        right: 2px;
                        color: #88ff88;
                        font-weight: 600;
                        font-size: 8px;
                        text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                    `;
                    slot.appendChild(count);
                } else {
                    slot.innerHTML = '<span style="color:rgba(255,255,255,0.08); font-size: 7px;">empty</span>';
                }

                // Ctrl click to swap/transfer item stacks between player & container inventories
                slot.onclick = (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const target = (this === window.playerInventory) ? window.activeContainerInventory : window.playerInventory;
                        if (target) {
                            this.transferStack(r, c, target);
                        }
                    }
                };

                gridContainer.appendChild(slot);
            }
        }
        this.inventoryEl.appendChild(gridContainer);

        // Debug Panel
        const debugPanel = document.createElement('div');
        debugPanel.style.cssText = `
            margin-top: 4px;
            display: flex;
            gap: 3px;
            justify-content: space-between;
        `;

        const addTestBtn = document.createElement('button');
        addTestBtn.innerText = '+ Item';
        addTestBtn.style.cssText = `
            background: rgba(34, 85, 136, 0.6);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 3px 6px;
            border-radius: 1px;
            cursor: pointer;
            font-size: 9px;
            flex-grow: 1;
            transition: background 0.2s;
        `;
        addTestBtn.onmouseenter = () => addTestBtn.style.background = 'rgba(34, 85, 136, 0.8)';
        addTestBtn.onmouseleave = () => addTestBtn.style.background = 'rgba(34, 85, 136, 0.6)';
        addTestBtn.onclick = () => {
            const types = ['rope', 'cylinder', 'cube-bevel', 'fins'];
            const randomType = types[Math.floor(Math.random() * types.length)];
            this.addItem(randomType, 10);
        };

        const clearBtn = document.createElement('button');
        clearBtn.innerText = 'Clear';
        clearBtn.style.cssText = `
            background: rgba(136, 51, 51, 0.6);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 3px 6px;
            border-radius: 1px;
            cursor: pointer;
            font-size: 9px;
            flex-grow: 1;
            transition: background 0.2s;
        `;
        clearBtn.onmouseenter = () => clearBtn.style.background = 'rgba(136, 51, 51, 0.8)';
        clearBtn.onmouseleave = () => clearBtn.style.background = 'rgba(136, 51, 51, 0.6)';
        clearBtn.onclick = () => {
            this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
            this.updateFlatItemsList();
            this.refreshInventoryUI();
        };

        debugPanel.appendChild(addTestBtn);
        debugPanel.appendChild(clearBtn);
        this.inventoryEl.appendChild(debugPanel);
    }
}
