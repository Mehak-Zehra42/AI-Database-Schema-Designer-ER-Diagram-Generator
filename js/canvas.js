/**
 * SVG Canvas Controller for rendering ER-Diagram nodes and connections.
 */
class CanvasController {
    constructor(svgId, viewportId, connectionsGroupId, tablesGroupId, containerId) {
        this.svg = document.getElementById(svgId);
        this.viewport = document.getElementById(viewportId);
        this.connectionsGroup = document.getElementById(connectionsGroupId);
        this.tablesGroup = document.getElementById(tablesGroupId);
        this.container = document.getElementById(containerId);
        this.background = document.getElementById('canvas-background');

        // State variables
        this.panX = 0;
        this.panY = 0;
        this.zoom = 0.9; // Slight zoom out initially to show layout
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        this.tables = []; // Local copy of table configurations
        this.cardWidth = 240;
        this.headerHeight = 41;
        this.rowHeight = 29;

        // Callback hooks to app.js
        this.onTableSelected = null;
        this.onTableMoved = null;
        this.onDeleteTable = null;

        this._initEventListeners();
        this.applyTransform();
    }

    /**
     * Bind all SVG canvas global events (pan, zoom).
     */
    _initEventListeners() {
        // 1. Zooming with Mouse Wheel
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            const direction = e.deltaY < 0 ? 1 : -1;
            
            const rect = this.svg.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate canvas coordinates under pointer before zoom
            const canvasX = (mouseX - this.panX) / this.zoom;
            const canvasY = (mouseY - this.panY) / this.zoom;

            // Calculate new zoom factor
            let newZoom = direction > 0 ? this.zoom * zoomFactor : this.zoom / zoomFactor;
            newZoom = Math.max(0.15, Math.min(3.0, newZoom)); // Clamp zoom

            // Adjust pan to center zoom on pointer
            this.panX = mouseX - canvasX * newZoom;
            this.panY = mouseY - canvasY * newZoom;
            this.zoom = newZoom;

            this.applyTransform();
        }, { passive: false });

        // 2. Panning on Background Drag
        this.background.addEventListener('mousedown', (e) => {
            // Only left-click pans on background
            if (e.button !== 0) return;
            
            this.isPanning = true;
            this.panStartX = e.clientX - this.panX;
            this.panStartY = e.clientY - this.panY;
            this.container.style.cursor = 'grabbing';
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.panStartX;
                this.panY = e.clientY - this.panStartY;
                this.applyTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
            }
        });

        // Resize observer to handle container size modifications
        const resizeObserver = new ResizeObserver(() => {
            // Redraw if needed or re-fit
        });
        resizeObserver.observe(this.container);
    }

    /**
     * Apply pan and zoom coordinates to the viewport group.
     */
    applyTransform() {
        this.viewport.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }

    /**
     * Set tables and draw everything.
     */
    setData(tables) {
        this.tables = tables;
        this.render();
    }

    /**
     * Full Render: Draw all cards and link lines.
     */
    render() {
        this.tablesGroup.innerHTML = '';
        this.connectionsGroup.innerHTML = '';

        if (!this.tables || this.tables.length === 0) return;

        // Render Table Cards
        this.tables.forEach(table => {
            this._renderTableCard(table);
        });

        // Render Connection Lines
        this.renderAllConnections();
    }

    /**
     * Render a single database table node card.
     */
    _renderTableCard(table) {
        const columnsLength = table.columns ? table.columns.length : 0;
        // Calculate height: Header (41px) + columns (29px each) + buffer (8px)
        const cardHeight = this.headerHeight + (columnsLength * this.rowHeight) + 8;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', `g-table-${table.name}`);
        
        const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
        foreignObject.setAttribute('x', table.x);
        foreignObject.setAttribute('y', table.y);
        foreignObject.setAttribute('width', this.cardWidth);
        foreignObject.setAttribute('height', cardHeight);
        foreignObject.setAttribute('id', `card-${table.name}`);

        // Build Table HTML Card
        let columnsHtml = '';
        if (table.columns) {
            table.columns.forEach((col, index) => {
                let keyIcon = '';
                if (col.isPrimaryKey) {
                    keyIcon = `<span class="material-icons-round key-icon pk-icon" title="Primary Key">vpn_key</span>`;
                }

                // Check if it is a foreign key
                const isFk = table.relations && table.relations.some(r => r.column === col.name);
                if (isFk) {
                    keyIcon += `<span class="material-icons-round key-icon fk-icon" title="Foreign Key">link</span>`;
                }

                // Standardize type style
                const typeClass = `type-${col.type.toLowerCase().split('(')[0]}`;

                columnsHtml += `
                    <div class="column-row" data-column-name="${col.name}">
                        <div class="col-left">
                            ${keyIcon}
                            <span>${col.name}</span>
                        </div>
                        <div class="col-right ${typeClass}">${col.type}</div>
                    </div>
                `;
            });
        }

        const activeClass = table.isActive ? 'active' : '';

        const cardContent = `
            <div class="table-card ${activeClass}" id="html-card-${table.name}">
                <div class="table-card-header">
                    <h4>
                        <span class="material-icons-round">table_chart</span>
                        <span>${table.name}</span>
                    </h4>
                    <div class="card-actions">
                        <button class="card-action-btn edit-btn" title="Edit Table Structure">
                            <span class="material-icons-round">edit</span>
                        </button>
                        <button class="card-action-btn delete-btn" title="Delete Table">
                            <span class="material-icons-round">delete</span>
                        </button>
                    </div>
                </div>
                <div class="table-card-columns">
                    ${columnsHtml}
                </div>
            </div>
        `;

        foreignObject.innerHTML = cardContent;
        g.appendChild(foreignObject);
        this.tablesGroup.appendChild(g);

        // Bind Drag and Edit Events to the card
        this._bindCardEvents(table, foreignObject);
    }

    /**
     * Bind drag and select events to a table card.
     */
    _bindCardEvents(table, foreignObject) {
        const header = foreignObject.querySelector('.table-card-header');
        const cardBody = foreignObject.querySelector('.table-card');

        // Dragging math
        header.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left click only
            e.stopPropagation(); // Avoid panning background

            // Toggle active styling
            this.tables.forEach(t => t.isActive = false);
            table.isActive = true;
            this.tablesGroup.querySelectorAll('.table-card').forEach(el => el.classList.remove('active'));
            cardBody.classList.add('active');

            if (this.onTableSelected) {
                this.onTableSelected(table);
            }

            const startX = e.clientX;
            const startY = e.clientY;
            const tableStartX = table.x;
            const tableStartY = table.y;

            const onMouseMove = (moveEvent) => {
                // Divide delta by zoom to maintain mouse alignment under zoom
                const dx = (moveEvent.clientX - startX) / this.zoom;
                const dy = (moveEvent.clientY - startY) / this.zoom;

                const newX = Math.round(tableStartX + dx);
                const newY = Math.round(tableStartY + dy);

                table.x = newX;
                table.y = newY;

                foreignObject.setAttribute('x', newX);
                foreignObject.setAttribute('y', newY);

                // Update lines attached to this table in real-time
                this.renderAllConnections();
            };

            const onMouseUp = () => {
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);
                
                if (this.onTableMoved) {
                    this.onTableMoved(table.name, table.x, table.y);
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // Click selection on table body
        cardBody.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.delete-btn')) {
                if (this.onDeleteTable) {
                    this.onDeleteTable(table.name);
                }
                return;
            }

            this.tables.forEach(t => t.isActive = false);
            table.isActive = true;
            this.tablesGroup.querySelectorAll('.table-card').forEach(el => el.classList.remove('active'));
            cardBody.classList.add('active');

            if (this.onTableSelected) {
                this.onTableSelected(table);
            }
        });
    }

    /**
     * Render all connection paths based on table state relationships.
     */
    renderAllConnections() {
        this.connectionsGroup.innerHTML = '';
        const drawnConnections = new Set(); // Prevent duplicates

        this.tables.forEach(table => {
            if (!table.relations) return;

            table.relations.forEach(rel => {
                const sourceTable = table;
                const targetTable = this.tables.find(t => t.name === rel.referencedTable);

                if (!targetTable) return;

                // Identify indices of related columns to compute dynamic Y coordinates
                const sourceColIndex = sourceTable.columns.findIndex(c => c.name === rel.column);
                const targetColIndex = targetTable.columns.findIndex(c => c.name === rel.referencedColumn);

                if (sourceColIndex === -1 || targetColIndex === -1) return;

                // Connection Key to avoid duplicates or track specific paths
                const connKey = `${sourceTable.name}.${rel.column}->${targetTable.name}.${rel.referencedColumn}`;
                if (drawnConnections.has(connKey)) return;
                drawnConnections.add(connKey);

                this._drawConnectionLine(
                    sourceTable, sourceColIndex,
                    targetTable, targetColIndex,
                    connKey
                );
            });
        });
    }

    /**
     * Draw individual connector line with dynamic port calculation.
     */
    _drawConnectionLine(sourceTable, sourceColIdx, targetTable, targetColIdx, key) {
        // Calculate port source/target Y coordinates
        // Table Y + Header (41px) + padding offset (6px) + Index * RowHeight + RowHeight/2
        const ySource = sourceTable.y + this.headerHeight + 4 + (sourceColIdx * this.rowHeight) + (this.rowHeight / 2);
        const yTarget = targetTable.y + this.headerHeight + 4 + (targetColIdx * this.rowHeight) + (this.rowHeight / 2);

        // Dynamic Port Side calculations: Start/End from left/right edges depending on card positions
        const sourceCenter = sourceTable.x + this.cardWidth / 2;
        const targetCenter = targetTable.x + this.cardWidth / 2;
        const sourceIsLeft = sourceCenter < targetCenter;

        let xSource, xTarget;
        if (sourceIsLeft) {
            xSource = sourceTable.x + this.cardWidth;
            xTarget = targetTable.x;
        } else {
            xSource = sourceTable.x;
            xTarget = targetTable.x + this.cardWidth;
        }

        // Draw Cubic Bezier curve paths
        // Control points offsets (dx) adjusts curve stiffness dynamically based on table spacing
        const distanceX = Math.abs(xTarget - xSource);
        const dx = Math.max(60, distanceX * 0.45);

        // Path description
        const pathData = `M ${xSource} ${ySource} C ${xSource + dx} ${ySource}, ${xTarget - dx} ${yTarget}, ${xTarget} ${yTarget}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('class', 'connection-path');
        path.setAttribute('id', `path-${key}`);
        path.setAttribute('marker-end', 'url(#arrow-marker)');

        // Path mouse hovering triggers custom markers & neon glow accents
        path.addEventListener('mouseenter', () => {
            path.setAttribute('marker-end', 'url(#arrow-marker-hover)');
        });
        path.addEventListener('mouseleave', () => {
            path.setAttribute('marker-end', 'url(#arrow-marker)');
        });

        this.connectionsGroup.appendChild(path);
    }

    /**
     * Zoom In helper.
     */
    zoomIn() {
        this.zoom = Math.min(3.0, this.zoom * 1.2);
        this.applyTransform();
    }

    /**
     * Zoom Out helper.
     */
    zoomOut() {
        this.zoom = Math.max(0.15, this.zoom / 1.2);
        this.applyTransform();
    }

    /**
     * Reset zoom factor and center view.
     */
    resetZoom() {
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.applyTransform();
    }

    /**
     * Auto focus view: adjust zoom and pan to fit all tables perfectly on screen.
     */
    fitToScreen() {
        if (!this.tables || this.tables.length === 0) return;

        // Calculate outer bounds of all table cards
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        this.tables.forEach(table => {
            const columnsLength = table.columns ? table.columns.length : 0;
            const cardHeight = this.headerHeight + (columnsLength * this.rowHeight) + 8;

            minX = Math.min(minX, table.x);
            minY = Math.min(minY, table.y);
            maxX = Math.max(maxX, table.x + this.cardWidth);
            maxY = Math.max(maxY, table.y + cardHeight);
        });

        // Add padding
        const padding = 60;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;

        // Get container size
        const containerWidth = this.container.clientWidth || 800;
        const containerHeight = this.container.clientHeight || 600;

        // Calculate optimal zoom to fit bounds
        const zoomX = containerWidth / boundsWidth;
        const zoomY = containerHeight / boundsHeight;
        let optimalZoom = Math.min(zoomX, zoomY);
        optimalZoom = Math.max(0.2, Math.min(1.5, optimalZoom)); // Clamp fit zoom

        // Calculate pan to center the bounds
        const boundsCenterX = minX + boundsWidth / 2;
        const boundsCenterY = minY + boundsHeight / 2;

        this.zoom = optimalZoom;
        this.panX = (containerWidth / 2) - (boundsCenterX * this.zoom);
        this.panY = (containerHeight / 2) - (boundsCenterY * this.zoom);

        this.applyTransform();
    }
}
