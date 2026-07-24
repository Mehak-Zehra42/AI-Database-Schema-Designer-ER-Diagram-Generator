/**
 * Main Application Coordinator & State Manager
 */
document.addEventListener("DOMContentLoaded", () => {
    // State
    let state = {
        apiKey: localStorage.getItem("gemini_api_key") || "",
        tables: JSON.parse(localStorage.getItem("schema_tables")) || [],
        activeTable: null,
        selectedExportDialect: "postgresql"
    };

    // UI Elements
    const apiKeyInput = document.getElementById("api-key-input");
    const btnSaveKey = document.getElementById("btn-save-key");
    const apiStatusBadge = document.getElementById("api-status-badge");
    
    const promptInput = document.getElementById("prompt-input");
    const btnGenerate = document.getElementById("btn-generate");
    const presetButtons = document.querySelectorAll(".preset-btn");
    
    const btnAddTable = document.getElementById("btn-add-table");
    const btnShowSql = document.getElementById("btn-show-sql");
    const btnExportSvg = document.getElementById("btn-export-svg");
    const btnClear = document.getElementById("btn-clear");
    
    const loadingOverlay = document.getElementById("loading-overlay");
    
    // Sidebar Elements
    const editorSidebar = document.getElementById("editor-sidebar");
    const sidebarTitle = document.getElementById("sidebar-title");
    const btnCloseSidebar = document.getElementById("btn-close-sidebar");
    const editTableNameInput = document.getElementById("edit-table-name");
    const columnsListContainer = document.getElementById("columns-list-container");
    const btnAddColumn = document.getElementById("btn-add-column");
    const btnDeleteTable = document.getElementById("btn-delete-table");
    
    // Modal Elements
    const sqlModal = document.getElementById("sql-modal");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const tabButtons = document.querySelectorAll(".tab-btn");
    const sqlCodeBlock = document.getElementById("sql-code-block");
    const btnCopySql = document.getElementById("btn-copy-sql");
    const btnDownloadSql = document.getElementById("btn-download-sql");

    // Canvas Navigation Controls
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnZoomReset = document.getElementById("btn-zoom-reset");
    const btnZoomFit = document.getElementById("btn-zoom-fit");

    // Initialize custom SVG Canvas Controller
    const canvas = new CanvasController(
        'svg-canvas',
        'canvas-viewport',
        'connections-group',
        'tables-group',
        'canvas-container'
    );

    // Initial state loading
    if (state.apiKey) {
        apiKeyInput.value = state.apiKey;
        updateApiStatus(true);
    }
    
    if (state.tables.length > 0) {
        canvas.setData(state.tables);
        updateActionButtonsState();
        // Zoom and fit loaded schema
        setTimeout(() => canvas.fitToScreen(), 200);
    }

    /* ==========================================================================
       Canvas Controller Callbacks
       ========================================================================== */
    canvas.onTableSelected = (table) => {
        state.activeTable = table;
        openSidebar(table);
    };

    canvas.onTableMoved = (tableName, x, y) => {
        const table = state.tables.find(t => t.name === tableName);
        if (table) {
            table.x = x;
            table.y = y;
            saveState();
        }
    };

    canvas.onDeleteTable = (tableName) => {
        deleteTable(tableName);
    };

    /* ==========================================================================
       Sidebar Controller Actions
       ========================================================================== */
    function openSidebar(table) {
        sidebarTitle.innerText = `Edit Table: ${table.name}`;
        editTableNameInput.value = table.name;
        renderSidebarColumns(table);
        editorSidebar.classList.add("open");
    }

    function closeSidebar() {
        editorSidebar.classList.remove("open");
        state.activeTable = null;
        state.tables.forEach(t => t.isActive = false);
        canvas.render();
    }

    btnCloseSidebar.addEventListener("click", closeSidebar);

    // Handle table rename
    editTableNameInput.addEventListener("input", (e) => {
        if (!state.activeTable) return;
        const newName = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (newName === "") return;

        // Double check uniqueness
        const nameExists = state.tables.some(t => t.name === newName && t !== state.activeTable);
        if (nameExists) return;

        const oldName = state.activeTable.name;
        
        // Update relations referencing this table
        state.tables.forEach(t => {
            if (t.relations) {
                t.relations.forEach(r => {
                    if (r.referencedTable === oldName) {
                        r.referencedTable = newName;
                    }
                });
            }
        });

        state.activeTable.name = newName;
        sidebarTitle.innerText = `Edit Table: ${newName}`;
        
        canvas.render();
        saveState();
    });

    // Populate columns editor panel in the sidebar
    function renderSidebarColumns(table) {
        columnsListContainer.innerHTML = "";

        if (!table.columns || table.columns.length === 0) {
            columnsListContainer.innerHTML = `<p class="help-text text-center">No columns in this table.</p>`;
            return;
        }

        table.columns.forEach((col, index) => {
            const card = document.createElement("div");
            card.className = "column-config-card";
            card.innerHTML = `
                <div class="col-config-header">
                    <input type="text" class="col-name-input" value="${col.name}" placeholder="column_name">
                    <select class="col-type-select">
                        <option value="INTEGER" ${col.type === "INTEGER" ? "selected" : ""}>INT/INTEGER</option>
                        <option value="VARCHAR" ${col.type === "VARCHAR" ? "selected" : ""}>VARCHAR</option>
                        <option value="TEXT" ${col.type === "TEXT" ? "selected" : ""}>TEXT</option>
                        <option value="BOOLEAN" ${col.type === "BOOLEAN" ? "selected" : ""}>BOOLEAN</option>
                        <option value="TIMESTAMP" ${col.type === "TIMESTAMP" ? "selected" : ""}>TIMESTAMP</option>
                        <option value="DATE" ${col.type === "DATE" ? "selected" : ""}>DATE</option>
                        <option value="DECIMAL" ${col.type === "DECIMAL" ? "selected" : ""}>DECIMAL</option>
                        <option value="FLOAT" ${col.type === "FLOAT" ? "selected" : ""}>FLOAT</option>
                    </select>
                    <button class="btn-delete-col" title="Delete Column">
                        <span class="material-icons-round">delete</span>
                    </button>
                </div>
                <div class="col-config-options">
                    <label class="checkbox-label">
                        <input type="checkbox" class="col-pk-check" ${col.isPrimaryKey ? "checked" : ""}>
                        <span>Primary Key</span>
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="col-null-check" ${col.isNullable ? "checked" : ""}>
                        <span>Nullable</span>
                    </label>
                </div>
                <!-- Foreign Key Relation Config -->
                <div class="col-relation-config">
                    <label class="checkbox-label">
                        <input type="checkbox" class="col-fk-check" ${hasRelation(table, col.name) ? "checked" : ""}>
                        <span>Foreign Key Relationship</span>
                    </label>
                    <div class="relation-selectors" style="display: ${hasRelation(table, col.name) ? 'flex' : 'none'}">
                        <select class="relation-table-select">
                            <option value="">-- Ref Table --</option>
                            ${state.tables
                                .filter(t => t.name !== table.name)
                                .map(t => `<option value="${t.name}" ${getRelationTargetTable(table, col.name) === t.name ? "selected" : ""}>${t.name}</option>`)
                                .join("")}
                        </select>
                        <select class="relation-column-select">
                            <option value="">-- Ref Column --</option>
                            ${getRelationTargetTable(table, col.name) 
                                ? getTableColumnsOptionMarkup(getRelationTargetTable(table, col.name), getRelationTargetColumn(table, col.name))
                                : ""
                            }
                        </select>
                    </div>
                </div>
            `;

            // Bind Event Listeners for this column card
            const nameInput = card.querySelector(".col-name-input");
            const typeSelect = card.querySelector(".col-type-select");
            const pkCheck = card.querySelector(".col-pk-check");
            const nullCheck = card.querySelector(".col-null-check");
            const fkCheck = card.querySelector(".col-fk-check");
            const relTableSelect = card.querySelector(".relation-table-select");
            const relColSelect = card.querySelector(".relation-column-select");
            const relSelectorContainer = card.querySelector(".relation-selectors");
            const deleteColBtn = card.querySelector(".btn-delete-col");

            // Name update
            nameInput.addEventListener("input", (e) => {
                const oldName = col.name;
                const newName = e.target.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
                if (newName === "") return;

                // Update column name in table list
                col.name = newName;

                // Update self relationships if any
                if (table.relations) {
                    table.relations.forEach(r => {
                        if (r.column === oldName) {
                            r.column = newName;
                        }
                    });
                }
                
                canvas.render();
                saveState();
            });

            // Type update
            typeSelect.addEventListener("change", (e) => {
                col.type = e.target.value;
                canvas.render();
                saveState();
            });

            // Primary key update
            pkCheck.addEventListener("change", (e) => {
                col.isPrimaryKey = e.target.checked;
                if (col.isPrimaryKey) {
                    col.isNullable = false; // Primary keys can't be null
                    nullCheck.checked = false;
                }
                canvas.render();
                saveState();
            });

            // Nullable update
            nullCheck.addEventListener("change", (e) => {
                col.isNullable = e.target.checked;
                if (col.isNullable && col.isPrimaryKey) {
                    col.isPrimaryKey = false;
                    pkCheck.checked = false;
                }
                canvas.render();
                saveState();
            });

            // Toggle relation config block visibility
            fkCheck.addEventListener("change", (e) => {
                if (e.target.checked) {
                    relSelectorContainer.style.display = "flex";
                } else {
                    relSelectorContainer.style.display = "none";
                    // Remove relationship
                    removeRelation(table, col.name);
                    relTableSelect.value = "";
                    relColSelect.innerHTML = `<option value="">-- Ref Column --</option>`;
                    canvas.render();
                    saveState();
                }
            });

            // Relation Table update
            relTableSelect.addEventListener("change", (e) => {
                const refTable = e.target.value;
                if (!refTable) {
                    removeRelation(table, col.name);
                    relColSelect.innerHTML = `<option value="">-- Ref Column --</option>`;
                    canvas.render();
                    saveState();
                    return;
                }

                // Populate column list of target table
                relColSelect.innerHTML = `<option value="">-- Ref Column --</option>` + getTableColumnsOptionMarkup(refTable);
                
                // Select first column (usually 'id') as default
                const refColumns = state.tables.find(t => t.name === refTable)?.columns || [];
                const firstCol = refColumns.find(c => c.isPrimaryKey)?.name || refColumns[0]?.name || "";
                
                if (firstCol) {
                    relColSelect.value = firstCol;
                    setRelation(table, col.name, refTable, firstCol);
                }

                canvas.render();
                saveState();
            });

            // Relation Column update
            relColSelect.addEventListener("change", (e) => {
                const refTable = relTableSelect.value;
                const refCol = e.target.value;
                if (refTable && refCol) {
                    setRelation(table, col.name, refTable, refCol);
                    canvas.render();
                    saveState();
                }
            });

            // Delete Column action
            deleteColBtn.addEventListener("click", () => {
                table.columns.splice(index, 1);
                // Remove any relations stemming from this column
                removeRelation(table, col.name);
                renderSidebarColumns(table);
                canvas.render();
                saveState();
            });

            columnsListContainer.appendChild(card);
        });
    }

    // Add new column helper
    btnAddColumn.addEventListener("click", () => {
        if (!state.activeTable) return;
        
        if (!state.activeTable.columns) {
            state.activeTable.columns = [];
        }

        // Generate unique column name
        let colNum = state.activeTable.columns.length + 1;
        let colName = `column_${colNum}`;
        while (state.activeTable.columns.some(c => c.name === colName)) {
            colNum++;
            colName = `column_${colNum}`;
        }

        const newCol = {
            name: colName,
            type: "VARCHAR",
            isPrimaryKey: false,
            isNullable: true,
            defaultValue: null
        };

        state.activeTable.columns.push(newCol);
        renderSidebarColumns(state.activeTable);
        canvas.render();
        saveState();
    });

    // Delete active table action
    btnDeleteTable.addEventListener("click", () => {
        if (state.activeTable) {
            deleteTable(state.activeTable.name);
        }
    });

    function deleteTable(tableName) {
        if (!confirm(`Are you sure you want to delete table "${tableName}"?`)) return;

        // 1. Remove table from list
        state.tables = state.tables.filter(t => t.name !== tableName);

        // 2. Remove any references pointing to this table
        state.tables.forEach(t => {
            if (t.relations) {
                t.relations = t.relations.filter(r => r.referencedTable !== tableName);
            }
        });

        // 3. Clear active states
        if (state.activeTable && state.activeTable.name === tableName) {
            closeSidebar();
        }

        canvas.setData(state.tables);
        updateActionButtonsState();
        saveState();
    }

    /* ==========================================================================
       Relationship helpers
       ========================================================================== */
    function hasRelation(table, colName) {
        return table.relations && table.relations.some(r => r.column === colName);
    }

    function getRelationTargetTable(table, colName) {
        const rel = table.relations?.find(r => r.column === colName);
        return rel ? rel.referencedTable : "";
    }

    function getRelationTargetColumn(table, colName) {
        const rel = table.relations?.find(r => r.column === colName);
        return rel ? rel.referencedColumn : "";
    }

    function setRelation(table, colName, refTable, refCol) {
        if (!table.relations) table.relations = [];
        
        // Remove existing if any
        table.relations = table.relations.filter(r => r.column !== colName);
        
        table.relations.push({
            column: colName,
            referencedTable: refTable,
            referencedColumn: refCol
        });
    }

    function removeRelation(table, colName) {
        if (table.relations) {
            table.relations = table.relations.filter(r => r.column !== colName);
        }
    }

    function getTableColumnsOptionMarkup(tableName, selectedColName = "") {
        const refTableObj = state.tables.find(t => t.name === tableName);
        if (!refTableObj || !refTableObj.columns) return "";
        return refTableObj.columns.map(c => `
            <option value="${c.name}" ${c.name === selectedColName ? "selected" : ""}>${c.name}</option>
        `).join("");
    }

    /* ==========================================================================
       Settings & Configuration Pane actions
       ========================================================================== */
    btnSaveKey.addEventListener("click", () => {
        const key = apiKeyInput.value.trim();
        if (key === "") {
            localStorage.removeItem("gemini_api_key");
            state.apiKey = "";
            updateApiStatus(false);
            alert("API key removed.");
        } else {
            localStorage.setItem("gemini_api_key", key);
            state.apiKey = key;
            updateApiStatus(true);
            alert("API Key saved securely!");
        }
    });

    function updateApiStatus(isConfigured) {
        if (isConfigured) {
            apiStatusBadge.className = "badge badge-success";
            apiStatusBadge.querySelector(".badge-text").innerText = "API Key Active";
        } else {
            apiStatusBadge.className = "badge badge-error";
            apiStatusBadge.querySelector(".badge-text").innerText = "API Key Missing";
        }
    }

    /* ==========================================================================
       AI Generation Handler
       ========================================================================== */
    btnGenerate.addEventListener("click", async () => {
        const prompt = promptInput.value.trim();
        
        if (!state.apiKey) {
            alert("Please provide your Google Gemini API Key first.");
            apiKeyInput.focus();
            return;
        }
        if (!prompt) {
            alert("Please describe the database schema you wish to generate.");
            promptInput.focus();
            return;
        }

        // Show loading screen
        loadingOverlay.classList.add("active");

        try {
            const schema = await GeminiClient.generateSchema(state.apiKey, prompt);
            
            // Map table structures coordinates in an organized layout grid
            const columnsCount = Math.max(2, Math.ceil(Math.sqrt(schema.tables.length)));
            const horizontalGap = 340;
            const verticalGap = 280;

            schema.tables.forEach((table, index) => {
                const col = index % columnsCount;
                const row = Math.floor(index / columnsCount);
                table.x = 100 + col * horizontalGap;
                table.y = 100 + row * verticalGap;
                table.isActive = false;
            });

            state.tables = schema.tables;
            canvas.setData(state.tables);
            
            closeSidebar();
            updateActionButtonsState();
            saveState();

            // Zoom out and center the newly generated schema
            setTimeout(() => {
                canvas.fitToScreen();
            }, 300);

        } catch (error) {
            alert(error.message || "Failed to generate database schema. Please try again.");
        } finally {
            loadingOverlay.classList.remove("active");
        }
    });

    // Preset Prompt loader
    presetButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            promptInput.value = btn.getAttribute("data-prompt");
            // Subtle glowing focus indicator
            promptInput.focus();
        });
    });

    /* ==========================================================================
       Workspace Header Toolbar Operations
       ========================================================================== */
    // Add Table manually
    btnAddTable.addEventListener("click", () => {
        // Position new table in center viewport relative to current zoom and pan
        const svgContainer = document.getElementById("canvas-container");
        const centerX = svgContainer.clientWidth / 2;
        const centerY = svgContainer.clientHeight / 2;
        
        // Calculate canvas space coordinates
        const canvasX = Math.round((centerX - canvas.panX) / canvas.zoom - (canvas.cardWidth / 2));
        const canvasY = Math.round((centerY - canvas.panY) / canvas.zoom - 100);

        // Generate unique name
        let tableNum = state.tables.length + 1;
        let tableName = `table_${tableNum}`;
        while (state.tables.some(t => t.name === tableName)) {
            tableNum++;
            tableName = `table_${tableNum}`;
        }

        const newTableObj = {
            name: tableName,
            description: `Manual database table creation`,
            x: canvasX,
            y: canvasY,
            isActive: true,
            columns: [
                { name: "id", type: "INTEGER", isPrimaryKey: true, isNullable: false, defaultValue: null }
            ],
            relations: []
        };

        state.tables.forEach(t => t.isActive = false);
        state.tables.push(newTableObj);
        
        canvas.setData(state.tables);
        state.activeTable = newTableObj;
        openSidebar(newTableObj);
        
        updateActionButtonsState();
        saveState();
    });

    // Clear Canvas action
    btnClear.addEventListener("click", () => {
        if (!confirm("Are you sure you want to clear the entire schema design canvas? This action is irreversible.")) return;
        state.tables = [];
        closeSidebar();
        canvas.setData([]);
        updateActionButtonsState();
        localStorage.removeItem("schema_tables");
    });

    function updateActionButtonsState() {
        const hasTables = state.tables.length > 0;
        btnShowSql.disabled = !hasTables;
        btnExportSvg.disabled = !hasTables;
    }

    function saveState() {
        localStorage.setItem("schema_tables", JSON.stringify(state.tables));
        updateActionButtonsState();
    }

    /* ==========================================================================
       Export SQL Modals and Logic
       ========================================================================== */
    btnShowSql.addEventListener("click", () => {
        if (state.tables.length === 0) return;
        renderSqlOutput();
        sqlModal.classList.add("active");
    });

    btnCloseModal.addEventListener("click", () => {
        sqlModal.classList.remove("active");
    });

    // Click outside modal content to close it
    sqlModal.addEventListener("click", (e) => {
        if (e.target === sqlModal) {
            sqlModal.classList.remove("active");
        }
    });

    // Tab switcher
    tabButtons.forEach(tab => {
        tab.addEventListener("click", (e) => {
            tabButtons.forEach(btn => btn.classList.remove("active"));
            tab.classList.add("active");
            state.selectedExportDialect = tab.getAttribute("data-db");
            renderSqlOutput();
        });
    });

    function renderSqlOutput() {
        const sql = SqlGenerator.generate(state.tables, state.selectedExportDialect);
        sqlCodeBlock.innerText = sql;
    }

    // Copy SQL to Clipboard
    btnCopySql.addEventListener("click", () => {
        const codeText = sqlCodeBlock.innerText;
        navigator.clipboard.writeText(codeText).then(() => {
            const btnText = btnCopySql.querySelector("span:not(.material-icons-round)");
            const originalText = btnText.innerText;
            btnText.innerText = "Copied!";
            btnCopySql.style.borderColor = "var(--accent-emerald)";
            btnCopySql.style.color = "var(--accent-emerald)";
            
            setTimeout(() => {
                btnText.innerText = originalText;
                btnCopySql.style.borderColor = "";
                btnCopySql.style.color = "";
            }, 2000);
        }).catch(err => {
            console.error("Clipboard copy failed: ", err);
        });
    });

    // Download SQL as file
    btnDownloadSql.addEventListener("click", () => {
        const codeText = sqlCodeBlock.innerText;
        const blob = new Blob([codeText], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `schema_${state.selectedExportDialect}.sql`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    /* ==========================================================================
       SVG Canvas Exporter Utility (Core SVG + CSS Embed Code)
       ========================================================================== */
    btnExportSvg.addEventListener("click", () => {
        if (state.tables.length === 0) return;
        
        // 1. Clone the root SVG
        const originalSvg = document.getElementById("svg-canvas");
        const svgClone = originalSvg.cloneNode(true);
        
        // Remove interactive UI buttons/controls floating inside viewport if any
        // We only want the grid, tables-group, and connections-group
        
        // 2. Fetch and embed all style sheets rules to style HTML inside foreignObject when downloaded
        let cssRulesText = "";
        for (const sheet of document.styleSheets) {
            try {
                // Ignore cross-origin sheets if any browser policy throws errors
                const rules = sheet.cssRules || sheet.rules;
                if (rules) {
                    for (let i = 0; i < rules.length; i++) {
                        cssRulesText += rules[i].cssText + "\n";
                    }
                }
            } catch (e) {
                console.warn("Could not read stylesheet rules (cross-origin check):", e);
            }
        }
        
        // Append font import to make the font look beautiful in the SVG file standalone
        const fontImports = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');\n`;
        
        // 3. Create style tag inside definitions
        const styleElement = document.createElementNS("http://www.w3.org/2000/svg", "style");
        styleElement.textContent = fontImports + cssRulesText;
        
        let defs = svgClone.querySelector("defs");
        if (!defs) {
            defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            svgClone.insertBefore(defs, svgClone.firstChild);
        }
        defs.appendChild(styleElement);
        
        // 4. Calculate full bounding box of all tables in diagram
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        state.tables.forEach(table => {
            const columnsLength = table.columns ? table.columns.length : 0;
            const cardHeight = canvas.headerHeight + (columnsLength * canvas.rowHeight) + 8;

            minX = Math.min(minX, table.x);
            minY = Math.min(minY, table.y);
            maxX = Math.max(maxX, table.x + canvas.cardWidth);
            maxY = Math.max(maxY, table.y + cardHeight);
        });

        // Add padding
        const padding = 50;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const boundsWidth = maxX - minX;
        const boundsHeight = maxY - minY;

        // 5. Shift elements so the top-leftmost card is positioned at (padding, padding)
        const viewportGroup = svgClone.querySelector("#canvas-viewport");
        if (viewportGroup) {
            // Remove zoom transforms in the download, represent it fully normal scale (1:1)
            viewportGroup.setAttribute("transform", `translate(${-minX}, ${-minY}) scale(1)`);
        }
        
        // 6. Set explicit widths, heights and viewBox of downloaded file matching boundaries
        svgClone.setAttribute("width", boundsWidth);
        svgClone.setAttribute("height", boundsHeight);
        svgClone.setAttribute("viewBox", `0 0 ${boundsWidth} ${boundsHeight}`);
        
        // Style background rect to match boundaries
        const bgRect = svgClone.querySelector("#canvas-background");
        if (bgRect) {
            bgRect.setAttribute("width", "100%");
            bgRect.setAttribute("height", "100%");
            bgRect.setAttribute("fill", "var(--bg-primary, #080b11)");
        }

        // 7. Serialize XML
        const xmlSerializer = new XMLSerializer();
        const svgStr = xmlSerializer.serializeToString(svgClone);
        
        // 8. Trigger download
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement("a");
        a.href = url;
        a.download = "database-er-diagram.svg";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    /* ==========================================================================
       Canvas Navigation Floating Button Events
       ========================================================================== */
    btnZoomIn.addEventListener("click", () => canvas.zoomIn());
    btnZoomOut.addEventListener("click", () => canvas.zoomOut());
    btnZoomReset.addEventListener("click", () => canvas.resetZoom());
    btnZoomFit.addEventListener("click", () => canvas.fitToScreen());
});
