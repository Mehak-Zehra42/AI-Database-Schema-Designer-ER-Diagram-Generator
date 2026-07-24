/**
 * Gemini API Client for Schema Generation
 */
const GeminiClient = {
    /**
     * Call the Gemini API to generate a database schema based on a user's description.
     * @param {string} apiKey - The Google Gemini API key.
     * @param {string} prompt - The database schema description prompt.
     * @returns {Promise<Object>} The parsed structured JSON schema database design.
     */
    async generateSchema(apiKey, prompt) {
        if (!apiKey) {
            throw new Error("Gemini API key is required. Please add it to the settings panel.");
        }
        if (!prompt || prompt.trim() === "") {
            throw new Error("Please enter a database description first.");
        }

        const model = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Define the target JSON structure we expect from the Gemini model
        const responseSchema = {
            type: "OBJECT",
            properties: {
                tables: {
                    type: "ARRAY",
                    description: "List of tables in the database schema.",
                    items: {
                        type: "OBJECT",
                        properties: {
                            name: {
                                type: "STRING",
                                description: "The table name in snake_case (e.g. order_items, users)."
                            },
                            description: {
                                type: "STRING",
                                description: "Brief description of the table's purpose."
                            },
                            columns: {
                                type: "ARRAY",
                                description: "List of columns inside the table.",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        name: {
                                            type: "STRING",
                                            description: "Column name in snake_case (e.g. user_id, email, created_at)."
                                        },
                                        type: {
                                            type: "STRING",
                                            description: "Standard SQL-style uppercase datatype. Choose from: INTEGER, VARCHAR, TEXT, BOOLEAN, TIMESTAMP, DATE, DECIMAL, FLOAT."
                                        },
                                        isPrimaryKey: {
                                            type: "BOOLEAN",
                                            description: "Set to true if this column is part of the table's Primary Key."
                                        },
                                        isNullable: {
                                            type: "BOOLEAN",
                                            description: "Set to true if this column is allowed to be NULL."
                                        },
                                        defaultValue: {
                                            type: "STRING",
                                            description: "Optional default value as a string (e.g., 'NOW()', 'true', '0', or null)."
                                        }
                                    },
                                    required: ["name", "type", "isPrimaryKey", "isNullable"]
                                }
                            },
                            relations: {
                                type: "ARRAY",
                                description: "Foreign key relationships that originate from this table and reference other tables.",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        column: {
                                            type: "STRING",
                                            description: "The column in the current table acting as the foreign key (e.g. user_id)."
                                        },
                                        referencedTable: {
                                            type: "STRING",
                                            description: "The name of the target table being referenced (e.g. users)."
                                        },
                                        referencedColumn: {
                                            type: "STRING",
                                            description: "The primary key column name in the referenced target table (e.g. id)."
                                        }
                                    },
                                    required: ["column", "referencedTable", "referencedColumn"]
                                }
                            }
                        },
                        required: ["name", "columns"]
                    }
                }
            },
            required: ["tables"]
        };

        const systemInstruction = `You are an expert database architect and engineer. Your task is to design a clean, normalized relational database schema (3NF where applicable) based on the user's description.
Analyze the user's request and outputs a structured database schema containing all necessary tables, fields, data types, primary keys, and foreign keys.

Rules for design:
1. Always generate a primary key column (prefer name 'id' with type 'INTEGER' or 'VARCHAR') for every table.
2. Use snake_case for table names and column names.
3. Ensure every foreign key reference has a matching table and column in the database schema.
4. Correctly identify logical relations between tables (e.g. linking order_items to orders, products to order_items, users to orders).
5. Specify standard uppercase data types: INTEGER, VARCHAR, TEXT, BOOLEAN, TIMESTAMP, DATE, DECIMAL.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: `Generate a database schema based on this description: ${prompt}`
                        }
                    ]
                }
            ],
            systemInstruction: {
                parts: [
                    {
                        text: systemInstruction
                    }
                ]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1 // Keep it deterministic and structured
            }
        };

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || `HTTP error ${response.status}`;
                
                // Specific helpful prompts for API key errors
                if (response.status === 400 && errorMessage.includes("API key")) {
                    throw new Error("Invalid API key. Please check your Gemini API key and try again.");
                }
                throw new Error(`Gemini API Error: ${errorMessage}`);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!textResponse) {
                throw new Error("Received an empty response from Gemini API.");
            }

            // Parse the JSON returned inside the response text
            const parsedSchema = JSON.parse(textResponse);
            
            if (!parsedSchema.tables || !Array.isArray(parsedSchema.tables)) {
                throw new Error("Invalid schema format: 'tables' array is missing.");
            }

            return parsedSchema;
        } catch (error) {
            console.error("Gemini API call failed:", error);
            throw error;
        }
    }
};
