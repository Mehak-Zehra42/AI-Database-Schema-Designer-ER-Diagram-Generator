# SchemaFlow AI: Database Schema Designer & ER-Diagram Generator

SchemaFlow AI is a premium, client-side, developer-focused web application designed to help database architects and developers build relational database schemas visually or via AI description prompts. It features a stunning dark dashboard, an interactive custom SVG canvas, and exports direct database schemas.

---

## 🚀 Key Features

*   **AI-Powered Database Generation**: Describe your database in plain English, and Google's Gemini API generates a complete relational schema with proper fields, datatypes, and primary/foreign key connections.
*   **Interactive SVG Canvas**: Drag-and-drop table nodes visually on a custom vector grid.
*   **Dynamic Port Switching Connections**: Relation lines are drawn using custom Cubic Bezier curves:
    $$Path = \text{"M } x_A,y_A \text{ C } (x_A + dx),y_A \text{ } (x_B - dx),y_B \text{ } x_B,y_B \text{"}$$
    Connector anchors dynamically recalculate and swap border sides (left vs right) as you drag nodes, avoiding overlapping lines.
*   **Pan & Zoom Vector Engine**: Navigating complex schemas is simple with mouse scroll zooming (centered on the mouse pointer) and grid panning.
*   **Entity Editing Sidebar**: Rename tables, add/delete columns, change datatypes, set primary keys, or customize foreign-key relations with simple dropdowns.
*   **Multi-Dialect SQL Exporter**: Exports database DDL scripts, topologically sorted (using a Post-Order DFS traversal) to ensure dependent tables are created in the correct sequence. It supports:
    *   **PostgreSQL** (with Serial Keys)
    *   **MySQL** (with AUTO_INCREMENT)
    *   **SQLite** (with INTEGER PRIMARY KEY AUTOINCREMENT)
*   **Embedded-Style SVG Export**: Export the diagram as an SVG image. The exporter reads and compiles all CSS stylesheets directly into the downloaded vector file, ensuring it displays perfectly offline.
*   **Auto-Save State**: Your designs are automatically cached in `localStorage` so that you never lose your progress on reload.

---

## 🛠 Tech Stack

*   **Frontend**: Vanilla HTML5, Custom CSS3, and modern ES6 JavaScript.
*   **Vector Engine**: SVG with HTML `<foreignObject>` integration to support flexible CSS grid styling inside vector coordinates.
*   **AI Integration**: Client-side Gemini API (running `gemini-2.5-flash` with JSON Structured response scheme).
*   **Dependencies**: Zero external libraries (100% lightweight vanilla code).

---

## 💻 Installation & Setup

1.  **Clone the repository**:
    ```bash
    git clone git@github.com:Mehak-Zehra42/AI-Database-Schema-Designer-ER-Diagram-Generator.git
    cd AI-Database-Schema-Designer-ER-Diagram-Generator
    ```
2.  **Start a local development server**:
    You can run any simple static server. For example, using Python:
    ```bash
    python -m http.server 8080
    ```
3.  **Open the dashboard**:
    Navigate to **[http://localhost:8080](http://localhost:8080)** in your browser.

---

## 🔑 Configure Gemini AI

1.  Go to [Google AI Studio](https://aistudio.google.com/) and grab a free API Key.
2.  Open the web app, paste the key in the **"Gemini API Setup"** box on the sidebar, and click the **Save** icon.
3.  Choose a preset prompt (e.g. *🛒 E-Commerce Shop*) or write your own custom requirements, then click **Generate Schema**.

---

## 📂 Project Structure

```
├── index.html          # Main application structure, modals, and canvas viewport
├── style.css           # Custom design tokens, glassmorphic styles, and keyframe animations
├── js/
│   ├── app.js          # App state manager, events controller, and SVG exporter
│   ├── canvas.js       # SVG coordinate calculations, zoom/pan events, and bezier paths
│   ├── gemini.js       # Client wrapper for Google Generative AI API calls
│   └── sql.js          # Topological sorting logic and multi-dialect SQL generator
├── USER_MANUAL.md      # Simple English operations guide
└── README.md           # Project documentation and specifications
```
