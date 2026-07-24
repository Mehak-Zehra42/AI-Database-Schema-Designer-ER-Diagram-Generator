/**
 * SQL Script Generator for PostgreSQL, MySQL, and SQLite
 */
const SqlGenerator = {
    /**
     * Generate SQL schema script.
     * @param {Array} tables - Array of table objects.
     * @param {string} dialect - Target database: 'postgresql', 'mysql', or 'sqlite'.
     * @returns {string} Fully formatted SQL script.
     */
    generate(tables, dialect) {
        if (!tables || tables.length === 0) {
            return "-- No tables designed yet.";
        }

        // Sort tables topologically to ensure referenced tables are created first
        const sortedTables = this._topologicalSort(tables);
        let sql = `-- ==========================================================================\n`;
        sql += `-- Generated Database Schema (${dialect.toUpperCase()})\n`;
        sql += `-- Created on: ${new Date().toISOString().split('T')[0]}\n`;
        sql += `-- ==========================================================================\n\n`;

        // If MySQL/PostgreSQL, optionally disable foreign key checks for clean execution if needed,
        // but since we topologically sort, it should be fine. We will output standard CREATE scripts.
        if (dialect === 'postgresql') {
            sql += `-- Drop tables if they exist (Clean start)\n`;
            // Generate drops in reverse order
            [...sortedTables].reverse().forEach(t => {
                sql += `DROP TABLE IF EXISTS "${t.name}" CASCADE;\n`;
            });
            sql += `\n`;
        } else if (dialect === 'mysql') {
            sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
            [...sortedTables].reverse().forEach(t => {
                sql += `DROP TABLE IF EXISTS \`${t.name}\`;\n`;
            });
            sql += `SET FOREIGN_KEY_CHECKS = 1;\n\n`;
        } else if (dialect === 'sqlite') {
            sql += `PRAGMA foreign_keys = OFF;\n`;
            [...sortedTables].reverse().forEach(t => {
                sql += `DROP TABLE IF EXISTS \`${t.name}\`;\n`;
            });
            sql += `PRAGMA foreign_keys = ON;\n\n`;
        }

        // Generate Table Creations
        for (const table of sortedTables) {
            if (table.description) {
                sql += `-- ${table.description}\n`;
            }
            sql += this._generateCreateTable(table, dialect);
            sql += `\n`;
        }

        return sql;
    },

    /**
     * Create CREATE TABLE statement for a single table.
     */
    _generateCreateTable(table, dialect) {
        const quote = dialect === 'postgresql' ? '"' : '`';
        let ddl = `CREATE TABLE ${quote}${table.name}${quote} (\n`;
        const lines = [];

        // Primary keys container
        const pkColumns = table.columns.filter(c => c.isPrimaryKey);
        const hasCompoundPk = pkColumns.length > 1;

        // 1. Column Declarations
        table.columns.forEach(col => {
            let colLine = `    ${quote}${col.name}${quote} `;
            colLine += this._mapDataType(col, dialect, hasCompoundPk);

            // Nullability
            if (col.isPrimaryKey && !hasCompoundPk) {
                // SQLite: INTEGER PRIMARY KEY AUTOINCREMENT has nullability implicit
                if (dialect !== 'sqlite' || !col.type.toUpperCase().includes('INT')) {
                    colLine += " NOT NULL";
                }
            } else if (!col.isNullable) {
                colLine += " NOT NULL";
            } else {
                colLine += " NULL";
            }

            // Default Values
            if (col.defaultValue !== undefined && col.defaultValue !== null && col.defaultValue !== "") {
                const defUpper = col.defaultValue.toUpperCase().trim();
                if (defUpper === 'NOW()' || defUpper === 'CURRENT_TIMESTAMP') {
                    if (dialect === 'mysql') {
                        colLine += " DEFAULT CURRENT_TIMESTAMP";
                    } else if (dialect === 'postgresql') {
                        colLine += " DEFAULT CURRENT_TIMESTAMP";
                    } else {
                        colLine += " DEFAULT CURRENT_TIMESTAMP";
                    }
                } else if (defUpper === 'NULL') {
                    colLine += " DEFAULT NULL";
                } else if (defUpper === 'TRUE' || defUpper === 'FALSE') {
                    colLine += ` DEFAULT ${defUpper}`;
                } else {
                    // Check if it needs quotes (if it's not a number/boolean)
                    if (isNaN(col.defaultValue)) {
                        colLine += ` DEFAULT '${col.defaultValue.replace(/'/g, "''")}'`;
                    } else {
                        colLine += ` DEFAULT ${col.defaultValue}`;
                    }
                }
            }

            lines.push(colLine);
        });

        // 2. Primary Key constraints (Compound keys or standard keys if preferred in constraints)
        if (hasCompoundPk) {
            const pkNames = pkColumns.map(c => `${quote}${c.name}${quote}`).join(', ');
            lines.push(`    PRIMARY KEY (${pkNames})`);
        } else if (pkColumns.length === 1 && dialect !== 'sqlite' && dialect !== 'postgresql') {
            // Write PK constraint at table level if not serial/autoincrement, for style.
            // But we actually inline PK for sqlite/postgresql and mysql.
            // Let's keep it simple: if it's not compound, we handled PK inline in _mapDataType.
        }

        // 3. Foreign Key Constraints
        if (table.relations && table.relations.length > 0) {
            table.relations.forEach(rel => {
                // Double check if the column exists in our table to prevent dangling references
                const colExists = table.columns.some(c => c.name === rel.column);
                if (colExists) {
                    let fkLine = `    FOREIGN KEY (${quote}${rel.column}${quote}) REFERENCES ${quote}${rel.referencedTable}${quote}(${quote}${rel.referencedColumn}${quote})`;
                    
                    // Add cascading options by default for better database utility
                    fkLine += " ON UPDATE CASCADE ON DELETE CASCADE";
                    lines.push(fkLine);
                }
            });
        }

        ddl += lines.join(",\n");
        ddl += `\n);\n`;
        return ddl;
    },

    /**
     * Maps database independent types to specific dialect types.
     */
    _mapDataType(column, dialect, hasCompoundPk) {
        const type = column.type.toUpperCase().trim();
        const isPk = column.isPrimaryKey && !hasCompoundPk;

        if (dialect === 'postgresql') {
            if (isPk && (type === 'INTEGER' || type === 'INT' || type === 'SERIAL')) {
                return 'SERIAL PRIMARY KEY';
            }
            switch (type) {
                case 'INTEGER':
                case 'INT':
                    return 'INTEGER';
                case 'VARCHAR':
                    return 'VARCHAR(255)';
                case 'TEXT':
                    return 'TEXT';
                case 'BOOLEAN':
                case 'BOOL':
                    return 'BOOLEAN';
                case 'TIMESTAMP':
                    return 'TIMESTAMP';
                case 'DATE':
                    return 'DATE';
                case 'DECIMAL':
                    return 'NUMERIC(10,2)';
                case 'FLOAT':
                case 'DOUBLE':
                    return 'DOUBLE PRECISION';
                default:
                    return type; // Fallback
            }
        } else if (dialect === 'mysql') {
            if (isPk && (type === 'INTEGER' || type === 'INT')) {
                return 'INT AUTO_INCREMENT PRIMARY KEY';
            }
            switch (type) {
                case 'INTEGER':
                case 'INT':
                    return 'INT';
                case 'VARCHAR':
                    return 'VARCHAR(255)';
                case 'TEXT':
                    return 'TEXT';
                case 'BOOLEAN':
                case 'BOOL':
                    return 'TINYINT(1)';
                case 'TIMESTAMP':
                    return 'TIMESTAMP';
                case 'DATE':
                    return 'DATE';
                case 'DECIMAL':
                    return 'DECIMAL(10,2)';
                case 'FLOAT':
                    return 'FLOAT';
                case 'DOUBLE':
                    return 'DOUBLE';
                default:
                    return type;
            }
        } else { // sqlite
            // SQLite autoincrement PK requires EXACTLY "INTEGER PRIMARY KEY AUTOINCREMENT"
            if (isPk && (type === 'INTEGER' || type === 'INT')) {
                return 'INTEGER PRIMARY KEY AUTOINCREMENT';
            }
            if (isPk) {
                return `${type} PRIMARY KEY`;
            }
            switch (type) {
                case 'INTEGER':
                case 'INT':
                    return 'INTEGER';
                case 'VARCHAR':
                    return 'TEXT'; // SQLite stores VARCHAR as TEXT
                case 'TEXT':
                    return 'TEXT';
                case 'BOOLEAN':
                case 'BOOL':
                    return 'INTEGER'; // SQLite uses 0/1 for booleans
                case 'TIMESTAMP':
                case 'DATE':
                    return 'TEXT'; // SQLite stores dates as ISO TEXT, numeric timestamps, or real julian days
                case 'DECIMAL':
                case 'FLOAT':
                case 'DOUBLE':
                    return 'REAL';
                default:
                    return type;
            }
        }
    },

    /**
     * Topological Sort using DFS (Post-order Traversal)
     * Handles circular dependencies by marking visited.
     */
    _topologicalSort(tables) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set(); // To detect cycles
        const tableMap = new Map(tables.map(t => [t.name, t]));

        const visit = (tableName) => {
            if (visited.has(tableName)) return;
            if (visiting.has(tableName)) {
                // Cycle detected, stop recursing to avoid infinite loop
                return;
            }

            visiting.add(tableName);

            const table = tableMap.get(tableName);
            if (table) {
                // Visit all tables referenced by this table's foreign keys first
                if (table.relations && table.relations.length > 0) {
                    for (const rel of table.relations) {
                        const target = rel.referencedTable;
                        // Avoid self-references and visit valid table dependencies
                        if (target !== tableName && tableMap.has(target)) {
                            visit(target);
                        }
                    }
                }
            }

            visiting.delete(tableName);
            visited.add(tableName);
            
            // Only add to sorted if it actually exists in our current table definitions
            if (table) {
                sorted.push(table);
            }
        };

        // Trigger DFS on all tables
        for (const table of tables) {
            visit(table.name);
        }

        return sorted;
    }
};
