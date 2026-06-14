import { ItemView, Menu, MenuItem, Notice, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type ProjectsForgePlugin from '../main';
import { ForgeElement, TaskNode } from '../engine/TaskIndex';
import { PriorityEngine, daysUntil } from '../engine/PriorityEngine';
import { StoryPointsPicker } from '../ui/StoryPointsPicker';
import { ElementType } from '../engine/TaskParser';
import { PromptModal } from '../ui/PromptModal';

export const FORGE_TREE_VIEW_TYPE = 'forge-tree-view';

type Tab = 'tree' | 'smart';

export class ForgeTreeView extends ItemView {
  private plugin: ProjectsForgePlugin;
  private activeTab: Tab = 'tree';
  private collapsed = new Set<string>();
  private smartFilter = new Set<string>();
  private draggedPath: string | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectsForgePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return FORGE_TREE_VIEW_TYPE;
  }
  getDisplayText(): string {
    return 'Projects Forge';
  }
  getIcon(): string {
    return 'hammer';
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  render(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('forge-view');

    this.renderHeader(container);

    const content = container.createDiv({ cls: 'forge-content' });
    if (this.activeTab === 'tree') {
      this.renderTree(content);
    } else {
      this.renderSmart(content);
    }
  }

  private async mutate(
    label: string,
    paths: string[],
    work: () => Promise<void>
  ): Promise<void> {
    await this.plugin.history.run(label, paths, work);
  }

  private renderHeader(container: HTMLElement): void {
  const header = container.createDiv({ cls: 'forge-header' });

  const tabs = header.createDiv({ cls: 'forge-tabs' });
  const treeTab = tabs.createDiv({ cls: 'forge-tab', text: 'Tree' });
  if (this.activeTab === 'tree') treeTab.addClass('forge-tab-active');
  treeTab.addEventListener('click', () => { this.activeTab = 'tree'; this.render(); });

  if (this.plugin.settings.smartViewEnabled) {
    const smartTab = tabs.createDiv({ cls: 'forge-tab', text: 'Smart' });
    if (this.activeTab === 'smart') smartTab.addClass('forge-tab-active');
    smartTab.addEventListener('click', () => { this.activeTab = 'smart'; this.render(); });
  }

  const actions = header.createDiv({ cls: 'forge-header-actions' });

  const undoBtn = actions.createEl('button', { cls: 'forge-icon-btn' });
  setIcon(undoBtn, 'undo-2');
  undoBtn.setAttr('aria-label',
    this.plugin.history.undoLabel() ? `Undo: ${this.plugin.history.undoLabel()}` : 'Nothing to undo');
  undoBtn.toggleClass('forge-disabled', !this.plugin.history.canUndo());
  undoBtn.addEventListener('click', async () => {
    if (!this.plugin.history.canUndo()) { new Notice('Nothing to undo'); return; }
    await this.plugin.history.undo();
  });

  const redoBtn = actions.createEl('button', { cls: 'forge-icon-btn' });
  setIcon(redoBtn, 'redo-2');
  redoBtn.setAttr('aria-label',
    this.plugin.history.redoLabel() ? `Redo: ${this.plugin.history.redoLabel()}` : 'Nothing to redo');
  redoBtn.toggleClass('forge-disabled', !this.plugin.history.canRedo());
  redoBtn.addEventListener('click', async () => {
    if (!this.plugin.history.canRedo()) { new Notice('Nothing to redo'); return; }
    await this.plugin.history.redo();
  });

  const ctxBtn = actions.createEl('button', { cls: 'forge-icon-btn' });
  setIcon(ctxBtn, 'tag');
  ctxBtn.setAttr('aria-label', 'Manage contexts');
  ctxBtn.addEventListener('click', () => this.plugin.contextManager.openManager());

  const tbBtn = actions.createEl('button', { cls: 'forge-icon-btn' });
  setIcon(tbBtn, 'package');
  tbBtn.setAttr('aria-label', 'Manage task blocks');
  tbBtn.addEventListener('click', () => this.plugin.taskBlockManager.openManager());

  if (this.activeTab === 'tree') {
    const toolbar = container.createDiv({ cls: 'forge-toolbar' });
    const taskBtn = toolbar.createEl('button', { cls: 'forge-tool-btn', text: '+ Task' });
    taskBtn.addEventListener('click', () => this.plugin.creator.create('task', null));
    const folderBtn = toolbar.createEl('button', { cls: 'forge-tool-btn', text: '📁 Folder' });
    folderBtn.addEventListener('click', () => this.plugin.creator.create('folder', null));
    const projectBtn = toolbar.createEl('button', { cls: 'forge-tool-btn', text: '📋 Project' });
    projectBtn.addEventListener('click', () => this.plugin.creator.create('project', null));
  }
}

  private renderTree(content: HTMLElement): void {
    const tree = this.plugin.index.getTree();
    const treeEl = content.createDiv({ cls: 'forge-tree' });

    if (tree.length === 0) {
      treeEl.createDiv({
        cls: 'forge-empty',
        text: 'No elements yet. Use the toolbar to create one.',
      });
    }

    for (const node of tree) {
      this.renderNode(treeEl, node, 0);
    }

    treeEl.addEventListener('dragover', (e) => e.preventDefault());
    treeEl.addEventListener('drop', (e) => {
      if (e.target === treeEl && this.draggedPath) {
        e.preventDefault();
        void this.plugin.mover.move(this.draggedPath, null);
        this.draggedPath = null;
      }
    });
  }

  private renderNode(parent: HTMLElement, node: TaskNode, depth: number): void {
    const el = node.element;
    const hasChildren = node.children.length > 0;
    const isCollapsed = this.collapsed.has(el.path);
    const autoCollapsed =
      this.plugin.settings.autoCollapse && !el.isFolder && el.status === 'done' && hasChildren;

    const row = parent.createDiv({ cls: 'forge-row' });
    row.style.paddingLeft = `${depth * 16 + 4}px`;
    row.setAttr('draggable', 'true');

    row.addEventListener('dragstart', (e) => {
      this.draggedPath = el.path;
      e.dataTransfer?.setData('text/plain', el.path);
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      row.addClass('forge-drop-target');
    });
    row.addEventListener('dragleave', () => row.removeClass('forge-drop-target'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.removeClass('forge-drop-target');
      if (this.draggedPath && this.draggedPath !== el.path) {
        void this.plugin.mover.move(this.draggedPath, el.path);
      }
      this.draggedPath = null;
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, el);
    });

    const toggle = row.createDiv({ cls: 'forge-toggle' });
    if ((el.isFolder || el.isProject) && hasChildren) {
      setIcon(toggle, isCollapsed ? 'chevron-right' : 'chevron-down');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCollapsed) this.collapsed.delete(el.path);
        else this.collapsed.add(el.path);
        this.render();
      });
    }

    // type / status icon
    const icon = row.createDiv({ cls: 'forge-status-icon' });
    if (el.isFolder) {
      icon.setText('📁');
      icon.addClass('forge-folder-icon');
    } else {
      icon.setText(el.status === 'done' ? '☑' : '☐');
      icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = el.status === 'open' ? 'done' : 'open';
        void this.mutate('Toggle status', [el.path], async () => {
          await this.plugin.parser.setStatus(el.file, next);
        });
      });
    }

    // title
    const titleCls = el.isProject ? 'forge-title forge-project-title' : 'forge-title';
    const title = row.createDiv({ cls: titleCls, text: el.title });
    title.addEventListener('click', () => void this.openElement(el));

    if (!el.isFolder) {
      const star = row.createDiv({ cls: 'forge-star', text: el.starred ? '⭐' : '☆' });
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.mutate('Toggle star', [el.path], async () => {
          await this.plugin.parser.toggleStar(el.file, !el.starred);
        });
      });

      if (this.plugin.settings.showStoryPoints) {
        const sp = row.createDiv({
          cls: 'forge-sp-chip',
          text: el.storyPoints !== null ? `SP:${el.storyPoints}` : 'SP:–',
        });
        sp.addEventListener('click', (e) => {
          e.stopPropagation();
          StoryPointsPicker.show(sp, el.storyPoints, (value) => {
            void this.mutate('Set story points', [el.path], async () => {
              await this.plugin.parser.setStoryPoints(el.file, value);
            });
          });
        });
      }

      if (el.priority > 0) {
        row.createDiv({ cls: 'forge-priority', text: `P${el.priority}` });
      }
    }

    if (el.taskBlock) {
      const tb = this.plugin.index.getTaskBlock(el.taskBlock);
      const name = tb ? tb.name : el.taskBlock.split('/').pop()?.replace(/\.md$/, '') ?? '';
      row.createDiv({ cls: 'forge-taskblock-tag', text: `📦 ${name}` });
    }

    this.renderContexts(row, el);

    if (el.dueDate) {
      const days = daysUntil(el.dueDate);
      const due = row.createDiv({ cls: 'forge-due', text: `📅 ${el.dueDate}` });
      if (days !== null && days < 0) due.addClass('forge-overdue');
      else if (days === 0) due.addClass('forge-due-today');
    }

    if (hasChildren && !isCollapsed && !autoCollapsed) {
      for (const child of node.children) {
        this.renderNode(parent, child, depth + 1);
      }
    }
  }

  private renderContexts(row: HTMLElement, el: ForgeElement): void {
    if (el.contexts.length === 0) return;
    const wrap = row.createDiv({ cls: 'forge-ctx-wrap' });
    for (const ctxPath of el.contexts) {
      const ctx = this.plugin.index.getContext(ctxPath);
      const name = ctx ? ctx.name : ctxPath.split('/').pop()?.replace(/\.md$/, '') ?? ctxPath;
      wrap.createDiv({ cls: 'forge-ctx-tag', text: name });
    }
  }

  private renderSmart(content: HTMLElement): void {
    const smart = content.createDiv({ cls: 'forge-smart' });

    const contexts = this.plugin.index.getAllContexts();
    if (contexts.length > 0) {
      const filterBar = smart.createDiv({ cls: 'forge-filter-bar' });
      for (const ctx of contexts) {
        const chip = filterBar.createDiv({ cls: 'forge-filter-chip', text: ctx.name });
        if (this.smartFilter.has(ctx.path)) chip.addClass('forge-filter-chip-active');
        chip.addEventListener('click', () => {
          if (this.smartFilter.has(ctx.path)) this.smartFilter.delete(ctx.path);
          else this.smartFilter.add(ctx.path);
          this.render();
        });
      }
    }

    const list = smart.createDiv({ cls: 'forge-smart-list' });
    const items = this.getSmartItems();

    if (items.length === 0) {
      list.createDiv({ cls: 'forge-empty', text: 'No active tasks right now.' });
    }

    for (const { element, score } of items) {
      const urgency = PriorityEngine.urgency(score);
      const row = list.createDiv({ cls: `forge-smart-row forge-urgency-${urgency}` });

      const check = row.createDiv({ cls: 'forge-checkbox', text: '☐' });
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.mutate('Complete task', [element.path], async () => {
          await this.plugin.parser.setStatus(element.file, 'done');
        });
      });

      const main = row.createDiv({ cls: 'forge-smart-main' });
      const titleCls = element.isProject ? 'forge-title forge-project-title' : 'forge-title';
      const title = main.createDiv({ cls: titleCls, text: element.title });
      title.addEventListener('click', () => void this.openElement(element));

      const meta = main.createDiv({ cls: 'forge-smart-meta' });
      if (element.starred) meta.createSpan({ cls: 'forge-starred', text: '⭐' });
      if (element.priority > 0) meta.createSpan({ text: `P${element.priority}` });
      if (element.storyPoints !== null) meta.createSpan({ text: `SP:${element.storyPoints}` });
      if (element.dueDate) meta.createSpan({ cls: 'forge-due', text: `📅 ${element.dueDate}` });
      meta.createSpan({ cls: 'forge-score', text: `⚡${score}` });

      this.renderContexts(main, element);
    }
  }

  /**
   * "Active tasks": uncompleted, non-folder elements that have no open
   * descendant tasks, with a start date of today or earlier (or none),
   * optionally filtered by context.
   */
  private getSmartItems(): { element: ForgeElement; score: number }[] {
    const result: { element: ForgeElement; score: number }[] = [];

    for (const el of this.plugin.index.getAllElements()) {
      if (el.isFolder) continue;
      if (el.status !== 'open') continue;
      if (this.plugin.index.hasOpenDescendant(el.path)) continue;

      const startDays = daysUntil(el.startDate);
      if (startDays !== null && startDays > 0) continue;

      if (this.smartFilter.size > 0) {
        const match = el.contexts.some((c) => this.smartFilter.has(c));
        if (!match) continue;
      }

      result.push({ element: el, score: PriorityEngine.calculate(el) });
    }

    result.sort((a, b) => b.score - a.score);
    return result;
  }

  private async openElement(el: ForgeElement): Promise<void> {
    const file = el.file;
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  private showContextMenu(evt: MouseEvent, el: ForgeElement): void {
    const menu = new Menu();

    menu.addItem((item) =>
      item.setTitle('Open').setIcon('file').onClick(() => void this.openElement(el))
    );
    menu.addItem((item) =>
      item.setTitle('Rename').setIcon('pencil').onClick(() => {
        new PromptModal(this.app, 'Rename element', el.title, async (value) => {
          await this.mutate('Rename element', [el.path], async () => {
            await this.plugin.parser.setTitle(el.file, value);
          });
        }).open();
      })
    );

    menu.addSeparator();

    // Subtasks/subprojects/subfolders are allowed under ANY element.
    menu.addItem((item) =>
      item.setTitle('Add subtask').setIcon('plus').onClick(() =>
        this.plugin.creator.create('task', el.path)
      )
    );
    menu.addItem((item) =>
      item.setTitle('Add subproject').setIcon('plus').onClick(() =>
        this.plugin.creator.create('project', el.path)
      )
    );
    menu.addItem((item) =>
      item.setTitle('Add subfolder').setIcon('plus').onClick(() =>
        this.plugin.creator.create('folder', el.path)
      )
    );

    menu.addSeparator();

    // Context selection (multi) directly from the menu.
    menu.addItem((item) => {
      item.setTitle('Contexts').setIcon('tag');
      const sub = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();
      const contexts = this.plugin.index.getAllContexts();
      if (contexts.length === 0) {
        sub.addItem((s: MenuItem) => s.setTitle('No contexts defined').setDisabled(true));
      }
      for (const ctx of contexts) {
        sub.addItem((s: MenuItem) => {
          s.setTitle(ctx.name);
          s.setChecked(el.contexts.includes(ctx.path));
          s.onClick(async () => {
            const next = new Set(el.contexts);
            if (next.has(ctx.path)) next.delete(ctx.path);
            else next.add(ctx.path);
            await this.mutate('Set contexts', [el.path], async () => {
              await this.plugin.parser.setContexts(el.file, Array.from(next));
            });
          });
        });
      }
    });

       // Task block selection (single value) directly from the menu.
    menu.addItem((item) => {
      item.setTitle('Task block').setIcon('package');
      const sub = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();
      const blocks = this.plugin.index.getAllTaskBlocks();
      sub.addItem((s: MenuItem) => {
        s.setTitle('None');
        s.setChecked(el.taskBlock === null);
        s.onClick(async () => {
          await this.mutate('Set task block', [el.path], async () => {
            await this.plugin.parser.setTaskBlock(el.file, null);
          });
        });
      });
      if (blocks.length === 0) {
        sub.addItem((s: MenuItem) => s.setTitle('No task blocks defined').setDisabled(true));
      }
      for (const tb of blocks) {
        sub.addItem((s: MenuItem) => {
          s.setTitle(tb.name);
          s.setChecked(el.taskBlock === tb.path);
          s.onClick(async () => {
            await this.mutate('Set task block', [el.path], async () => {
              await this.plugin.parser.setTaskBlock(el.file, tb.path);
            });
          });
        });
      }
    });

    menu.addSeparator();

    const convert = (type: ElementType): void => {
      void this.mutate('Convert type', [el.path], async () => {
        await this.plugin.parser.convertType(el.file, type);
      });
    };

    if (!el.isFolder) {
      menu.addItem((item) =>
        item.setTitle('Convert to folder').setIcon('folder').onClick(() => convert('folder'))
      );
    }
    if (!el.isProject) {
      menu.addItem((item) =>
        item
          .setTitle('Convert to project')
          .setIcon('clipboard-list')
          .onClick(() => convert('project'))
      );
    }
    if (el.isFolder || el.isProject) {
      menu.addItem((item) =>
        item.setTitle('Convert to task').setIcon('check-square').onClick(() => convert('task'))
      );
    }

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('Move to root')
        .setIcon('corner-up-left')
        .onClick(() => void this.plugin.mover.move(el.path, null))
    );

    menu.addSeparator();

    menu.addItem((item) =>
      item
        .setTitle('Delete (with children)')
        .setIcon('trash')
        .onClick(async () => {
          const paths = this.plugin.index.getSubtreePaths(el.path);
          const childCount = paths.length - 1;
          if (this.plugin.settings.confirmBeforeDelete) {
            const extra =
              childCount > 0 ? ` and ${childCount} child element(s)` : '';
            const ok = window.confirm(`Delete "${el.title}"${extra}?`);
            if (!ok) return;
          }
          await this.mutate(`Delete ${el.title}`, paths, async () => {
            for (const p of paths) {
              const f = this.app.vault.getAbstractFileByPath(p);
              if (f instanceof TFile) await this.app.vault.delete(f);
            }
          });
          new Notice(`Deleted: ${el.title}`);
        })
    );

    menu.showAtMouseEvent(evt);
  }

  async onClose(): Promise<void> {
    // no-op
  }
}