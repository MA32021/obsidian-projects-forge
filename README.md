# Projects Forge

**Forge your tasks and projects** — hierarchical task management for [Obsidian](https://obsidian.md).

Projects Forge gives you a dedicated side panel to organize your life as a tree of **folders**, **projects**, and **tasks**. Every element lives in its own Markdown note with clean frontmatter, so your data stays portable and human-readable.

---

## Features

### 🌳 Hierarchical Tree
- Infinite nesting: folders contain projects and tasks, projects contain subtasks
- Collapse / expand any branch
- Drag-and-drop to reorganize the hierarchy
- Auto-collapse completed branches (optional)

### ☑️ Status Tracking
- Click the checkbox icon directly in the tree to mark tasks and projects done
- Completed items get a strikethrough title
- No automatic status propagation — you stay in control

### 📂 Projects vs Tasks vs Folders
- **Folders** (`📁`) — non-actionable containers for grouping
- **Projects** (`📋`) — actionable containers that can hold subtasks
- **Tasks** (`☐`) — simple actionable items
- Convert any element to another type with one click via context menu

### ⚡ Smart View
- See only the tasks you can work on *right now*
- Filters out completed items, folders, and tasks with future start dates
- Tasks whose children are still open are hidden until children are done
- Sorted by a dynamic priority score
- Color-coded urgency: critical (red), high (orange), medium (yellow), low (default)
- Full context menu support — right-click any element to edit

### 🗓️ Date Management
- **Three date fields** per element: Start date, Due date, Review date
- Set dates via context menu with quick presets: Today, Tomorrow, Next Week, Next Month
- Custom date picker for arbitrary dates
- Clear any date with one click
- **Two display modes** (toggle via the 👁 button in the header):
  - **Full dates** — shows complete date strings (`📅 2026-06-15`, `▶ 2026-06-13`, `🔄 2026-06-20`)
  - **Days left** — shows relative time (`📅 3d`, `📅 today`, `📅 -2d ago`, `📅 ∞` if no due date set)
- Visual indicators: overdue dates in red, today in yellow, future start dates in grey italic

### 👁 Display Customization
- Toggle visibility of individual metadata fields via the 👁 (eye) button menu:
  - **Starred** ⭐ — show/hide star indicators
  - **Story Points** — show/hide SP chips
  - **Priority** — show/hide P1-P10 labels
- Settings apply to both Tree and Smart views
- Compact mode: hide everything except titles for a minimal view

### 🏷️ Contexts
- Tag elements with multiple contexts (e.g. `@home`, `@office`, `@phone`)
- Contexts are separate notes in a dedicated folder
- Filter both Tree and Smart views by context (multiple selection)
- Set contexts from the right-click menu or during creation
- Sub-elements inherit parent contexts by default

### 📦 Task Blocks
- Assign exactly one task block per task (e.g. `Sprint 12`, `Q4 Goals`)
- Task blocks are separate notes — great for sprint planning or milestone tracking
- Filter and organize work by block

### 🎯 Story Points
- Estimate effort with Fibonacci numbers: 1, 2, 3, 5, 8, 13, 21, 34, 55, 89
- Click the `SP:5` chip on any task to pick a value
- Contributes to the Smart View priority score
- Can be hidden via the 👁 display menu

### 🔄 Undo / Redo
- Full undo/redo for all mutations (create, delete, move, rename, status toggle, date changes, etc.)
- History is shown in the panel header with action labels
- Snapshot-based — safe even across restarts
- Keyboard-friendly: hover over undo/redo buttons to see available actions

### ⌨️ Commands
- `Open Forge panel` — open or focus the side panel
- `New task` / `New project` / `New folder` — create from anywhere
- `Undo last action` / `Redo last action`
- `Refresh index` — force a full re-index

### ⚙️ Settings
- Custom folders for elements, contexts, and task blocks
- Default priority for new tasks (0-10)
- Toggle auto-collapse, Story Points display, Smart View, and delete confirmation

---

## Context Menu Reference

Right-click any element in Tree or Smart view to access:

| Menu Item | Description |
|-----------|-------------|
| **Open** | Open the element's note |
| **Rename** | Rename the element |
| **Add subtask / subproject / subfolder** | Create a child element |
| **Dates → Start / Due / Review** | Set dates with presets or custom picker |
| **Contexts** | Toggle multiple context tags |
| **Task block** | Assign a single task block |
| **Convert to...** | Switch between folder, project, and task |
| **Move to root** | Detach from parent |
| **Delete (with children)** | Recursively delete element and all descendants |

---

## Installation

### From the Community Plugin Browser *(once accepted)*
1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for **Projects Forge**
3. Install and enable

### Manual (BRAT or dev vault)
1. Download the latest release from [Releases](https://github.com/your-repo/projects-forge/releases)
2. Extract into `{vault}/.obsidian/plugins/projects-forge/`
3. Reload Obsidian and enable the plugin in Settings → Community Plugins

### For developers
```bash
git clone https://github.com/your-repo/projects-forge.git
cd projects-forge
npm install
npm run dev
```

Then symlink or copy the folder into your vault's `.obsidian/plugins/` directory.

---

## How It Works

### Data model

Every folder, project, and task is a **Markdown note** in a flat folder (default: `Forge/Elements/`). The hierarchy is defined by a `pf-parent` field pointing to another note via a wikilink.

**Example task note:**

```yaml
---
pf_element: true
title: "Buy groceries"
is_folder: false
is_project: false
status: open
priority: 5
starred: false
story_points: 3
pf-parent: "[[Forge/Elements/Weekly chores]]"
context:
  - "[[Forge/Contexts/@home]]"
task-block: "[[Forge/TaskBlocks/Sprint 12]]"
start_date: 2026-06-15
due_date: 2026-06-20
review_date: 2026-06-22
---
```

**Context note:**

```yaml
---
is_context: true
title: "@home"
---
```

**Task block note:**

```yaml
---
is_task_block: true
title: "Sprint 12"
---
```

### Priority Engine

Smart View sorts tasks by a score computed from:

- **Priority** (0–10) × 10
    
- **Starred** bonus: +30
    
- **Due date** proximity: up to +60 (overdue)
    
- **Story Points** bonus: up to +15 for small tasks
    

Urgency levels:

|Score|Urgency|Color|
|---|---|---|
|≥ 90|Critical|Red|
|≥ 60|High|Orange|
|≥ 30|Medium|Yellow|
|< 30|Low|None|

### Date Display Modes

|Mode|Start Date|Due Date|Review Date|No Due Date|
|---|---|---|---|---|
|**Full**|`▶ 2026-06-15`|`📅 2026-06-20`|`🔄 2026-06-22`|_(hidden)_|
|**Days Left**|`▶ 5d`|`📅 3d`|`🔄 7d`|`📅 ∞`|

Past dates show as negative: `📅 -2d ago`, overdue in red.

---

## Usage Tips

1. **Start with a folder** for each area of your life (Work, Personal, Health)
    
2. **Create projects** inside folders for multi-step outcomes
    
3. **Add tasks** to projects — they'll inherit contexts automatically
    
4. **Use contexts** to filter what's relevant right now
    
5. **Set due dates** to prioritize in Smart View
    
6. **Switch to Days Left mode** (👁 → Days left) for a quick overview of deadlines
    
7. **Hide metadata** (👁 → toggle fields) when you need a clean, minimal view
    
8. **Switch to Smart View** when you're ready to do focused work
    
9. **Right-click any element** in either view to access all editing options
    
10. **Use Undo/Redo** freely — every action is recorded
    

---

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

### Development setup

bash

npm install
npm run dev     # watch mode
npm run build   # production build

### Project structure


```text
src/
├── main.ts                  Plugin entry point
├── settings/Settings.ts     Settings interface & tab
├── engine/
│   ├── TaskIndex.ts         Flat index + tree builder
│   ├── TaskParser.ts        Frontmatter read/write
│   ├── PriorityEngine.ts    Smart View scoring + date helpers
│   └── HistoryManager.ts    Undo/redo engine
├── views/
│   └── ForgeTreeView.ts     Main panel (Tree + Smart tabs, display modes)
├── ui/
│   ├── StoryPointsPicker.ts Dropdown for SP values
│   └── PromptModal.ts       Rename dialog
└── operations/
    ├── TaskCreator.ts       Element creation + create modal
    ├── TaskMover.ts         Drag-and-drop moves
    ├── ContextManager.ts    Context CRUD
    └── TaskBlockManager.ts  Task block CRUD
```

---

## License

MIT © 2026

---

## Acknowledgements

Inspired by the task management philosophy of My Life Organized (MLO) — hierarchical structure, contexts, computed priority, and the "what to do right now" mindset. Rebuilt from the ground up as a first-class Obsidian citizen.