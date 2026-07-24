# User Manual: AI Database Schema Designer & ER-Diagram Generator

Welcome to **SchemaFlow AI**! This manual explains in simple English how to run, use, and modify your database designs, as well as how the application works behind the scenes.

---

## 1. How to Start the App

### Prerequisite:
You need a web browser (like Google Chrome, Microsoft Edge, or Mozilla Firefox).

### Steps to run locally:
1. Open your terminal or command prompt.
2. Make sure you are in the project folder.
3. Run the following command to start a local server:
   ```bash
   python -m http.server 8080
   ```
4. Open your web browser and go to:
   **[http://localhost:8080](http://localhost:8080)**

---

## 2. Main Features & How to Use Them

### A. AI Database Design (Automatic)
* **What it does**: You type a description of your database, and the AI designs all the tables, fields, and connections for you.
* **How to use**:
  1. Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
  2. Paste it in the **"Gemini API Setup"** box (top-left) and click the **Save** (disk) icon. The badge will turn green (**API Key Active**).
  3. Type what database you want to make in the box (or click one of the preset buttons, e.g., *🛒 E-Commerce Shop*).
  4. Click **"Generate Schema"**.
  5. The canvas will load and automatically arrange the tables.

### B. Manual Editing (Custom Changes)
* **Add a Table**: Click the **"New Table"** button in the top bar. A table will appear in the middle of your screen.
* **Edit Table Details**: Click on any table card. A panel will slide out from the right side.
  * **Rename Table**: Type in the "Table Name" input box.
  * **Add Column**: Click the **"+ Add"** button.
  * **Edit Column properties**: Change the name, choose the data type (INT, VARCHAR, TEXT, etc.), or check the boxes to make it a **Primary Key (PK)** or **Nullable** (can be empty).
  * **Link Columns (Foreign Key)**: Check the **"Foreign Key Relationship"** box under any column. Select the "Ref Table" (referenced table) and "Ref Column" (referenced column) from the dropdowns to draw a connection line.
  * **Delete Column**: Click the trash icon next to a column to delete it.
  * **Delete Table**: Click the red **"Delete Table"** button at the bottom of the sidebar.

### C. Canvas Controls (Navigation)
* **Pan (Move Board)**: Click and hold on the empty background, then drag your mouse to move the screen.
* **Zoom (In / Out)**: Use your mouse scroll wheel, or click the floating Zoom buttons in the bottom-left corner (+, -, reset, fit-to-screen).
* **Move Cards**: Click and hold the header of any table, then drag it around. The connecting lines will follow it automatically.

### D. Exporting Your Work
* **Export SQL**: Click **"Export SQL"** (top right) to see the exact SQL queries needed to build this database. You can copy the code or download the `.sql` file. It supports:
  * **PostgreSQL**
  * **MySQL**
  * **SQLite**
* **Export SVG (Download Image)**: Click **"Export SVG"** to download the diagram as a vector file. You can open it in any browser or edit it in vector tools like Illustrator or Figma.

---

## 3. What is Happening Under the Hood (How it Works)

1. **The Vector Canvas (SVG)**:
   Instead of drawing simple shapes, we use SVG (Scalable Vector Graphics). It means the image stays sharp even if you zoom in 300%. The table cards are drawn using `<foreignObject>`, which lets us render standard interactive HTML (text, selects, inputs) inside the vector space.
   
2. **Dynamic Line Calculations (Math)**:
   Connection lines are drawn as smooth S-shaped curves (Cubic Bezier Curves). The software calculates the exact position of both columns in real-time. If you drag Table A to the left of Table B, the line attaches to the right side of Table A. If you drag Table A to the right of Table B, the line shifts to the left side of Table A. This is called **Dynamic Port Switching**.

3. **Gemini AI Structured Outputs**:
   When you send a prompt, we configure the Gemini API to respond in **Structured JSON Mode**. This forces the AI to output exactly the columns, relationships, and types we need, eliminating markdown text wrapper errors.

4. **SQL Topological Sorting**:
   When exporting SQL, the application checks which tables depend on others (e.g., `orders` needs `users` to exist first). It sorts the tables using a **DFS Topological Sort** algorithm to ensure that tables are created in the correct order, avoiding dependency errors.

5. **SVG Style Compiler**:
   When exporting your diagram as an SVG file, the application clones the canvas and reads all CSS rules applied to the web app. It embeds these styles directly inside the SVG file. This ensures the downloaded image looks exactly like the dark theme dashboard even when viewed offline.
