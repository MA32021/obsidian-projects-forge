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

  // Настройки отображения
  private dateDisplayMode: 'full' | 'days-left' = 'full';
  private showStarred: boolean = true;
  private showStoryPoints: boolean = true;
  private showPriority: boolean = true;

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

  /**
  * Форматирует отображение даты в зависимости от выбранного режима.
  */
  private formatDateDisplay(dateStr: string, icon: string): string {
    if (this.dateDisplayMode === 'full') {
      return `${icon} ${dateStr}`;
    }

    // Режим days-left
    const d = daysUntil(dateStr);
    if (d === null) return `${icon} ${dateStr}`;

    if (d < 0) {
      return `${icon} ${Math.abs(d)}d ago`;
    } else if (d === 0) {
      return `${icon} today`;
    } else {
      return `${icon} ${d}d`;
    }
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

    // ========== КНОПКА НАСТРОЙКИ ОТОБРАЖЕНИЯ ==========
    const displayBtn = actions.createEl('button', { cls: 'forge-icon-btn' });
    setIcon(displayBtn, 'eye');
    displayBtn.setAttr('aria-label', 'Display options');
    displayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showDisplayOptionsMenu(displayBtn);
    });

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

    // Drag & Drop
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

    // ========== ПЕРВАЯ СТРОКА: Toggle + Icon + Title ==========
    const line1 = row.createDiv({ cls: 'forge-row-line1' });

    // Toggle
    const toggle = line1.createDiv({ cls: 'forge-toggle' });
    if ((el.isFolder || el.isProject) && hasChildren) {
      setIcon(toggle, isCollapsed ? 'chevron-right' : 'chevron-down');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCollapsed) this.collapsed.delete(el.path);
        else this.collapsed.add(el.path);
        this.render();
      });
    }

    // Status icon
    const icon = line1.createDiv({ cls: 'forge-status-icon' });
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

    // Title
    const titleCls = el.isProject ? 'forge-project-title' : '';
    const title = line1.createDiv({ cls: `forge-title ${titleCls}`, text: el.title });
    if (el.status === 'done') title.addClass('forge-done');
    title.addEventListener('click', () => void this.openElement(el));

    // ========== ВТОРАЯ СТРОКА: Metadata ==========
    const line2 = row.createDiv({ cls: 'forge-row-line2' });
    const hasMetadata = this.hasAnyMetadata(el);

    if (hasMetadata) {
      // Starred
      if (!el.isFolder && this.showStarred) {
        const star = line2.createSpan({ cls: 'forge-meta-item forge-meta-star', text: el.starred ? '⭐' : '☆' });
        star.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.mutate('Toggle star', [el.path], async () => {
            await this.plugin.parser.toggleStar(el.file, !el.starred);
          });
        });
      }

      // Story Points
      if (!el.isFolder && this.showStoryPoints) {
        const sp = line2.createSpan({
          cls: 'forge-meta-item forge-meta-sp',
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

      // Priority
      if (!el.isFolder && this.showPriority && el.priority > 0) {
        line2.createSpan({ cls: 'forge-meta-item forge-meta-priority', text: `P${el.priority}` });
      }

      // Task Block
      if (el.taskBlock) {
        const tb = this.plugin.index.getTaskBlock(el.taskBlock);
        const name = tb ? tb.name : el.taskBlock.split('/').pop()?.replace(/\.md$/, '') ?? '';
        line2.createSpan({ cls: 'forge-meta-item forge-meta-taskblock', text: `📦 ${name}` });
      }

      // Start date
      if (el.startDate) {
        const text = this.formatDateDisplay(el.startDate, '▶');
        line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-meta-start', text });
      }

      // Due date
      if (el.dueDate) {
        const text = this.formatDateDisplay(el.dueDate, '📅');
        const due = line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-meta-due', text });
        const days = daysUntil(el.dueDate);
        if (days !== null && days < 0) due.addClass('forge-overdue');
        else if (days === 0) due.addClass('forge-due-today');
      } else if (this.dateDisplayMode === 'days-left' && !el.isFolder) {
        line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-meta-due forge-due-none', text: '📅 ∞' });
      }

      // Review date
      if (el.reviewDate) {
        const text = this.formatDateDisplay(el.reviewDate, '🔄');
        line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-meta-review', text });
      }
    } else if (!el.isFolder) {
      // Показываем placeholder для единообразия
      line2.createSpan({ cls: 'forge-meta-empty', text: '—' });
    }

    // ========== Рендерим детей ==========
    if (hasChildren && !isCollapsed && !autoCollapsed) {
      for (const child of node.children) {
        this.renderNode(parent, child, depth + 1);
      }
    }
  }

  /**
   * Проверяет, есть ли у элемента какие-либо метаданные для отображения.
   */
  private hasAnyMetadata(el: ForgeElement): boolean {
    if (!el.isFolder) {
      if (this.showStarred || this.showStoryPoints || this.showPriority) return true;
      if (el.priority > 0 || el.starred || el.storyPoints !== null) return true;
    }
    if (el.taskBlock) return true;
    if (el.startDate || el.dueDate || el.reviewDate) return true;
    if (this.dateDisplayMode === 'days-left' && !el.isFolder) return true;
    return false;
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

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showContextMenu(e, element);
      });

      // ========== ПЕРВАЯ СТРОКА ==========
      const line1 = row.createDiv({ cls: 'forge-row-line1' });

      const check = line1.createDiv({ cls: 'forge-checkbox', text: '☐' });
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        void this.mutate('Complete task', [element.path], async () => {
          await this.plugin.parser.setStatus(element.file, 'done');
        });
      });

      const titleCls = element.isProject ? 'forge-project-title' : '';
      const title = line1.createDiv({ cls: `forge-title ${titleCls}`, text: element.title });
      title.addEventListener('click', () => void this.openElement(element));

      const scoreEl = line1.createDiv({ cls: 'forge-score', text: `⚡${score}` });

      // ========== ВТОРАЯ СТРОКА ==========
      const line2 = row.createDiv({ cls: 'forge-row-line2' });

      if (this.showStarred && element.starred) {
        const star = line2.createSpan({ cls: 'forge-meta-item forge-meta-star', text: '⭐' });
        star.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.mutate('Toggle star', [element.path], async () => {
            await this.plugin.parser.toggleStar(element.file, !element.starred);
          });
        });
      }

      if (this.showStoryPoints && element.storyPoints !== null) {
        const sp = line2.createSpan({
          cls: 'forge-meta-item forge-meta-sp',
          text: `SP:${element.storyPoints}`,
        });
        sp.addEventListener('click', (e) => {
          e.stopPropagation();
          StoryPointsPicker.show(sp, element.storyPoints, (value) => {
            void this.mutate('Set story points', [element.path], async () => {
              await this.plugin.parser.setStoryPoints(element.file, value);
            });
          });
        });
      }

      if (this.showPriority && element.priority > 0) {
        line2.createSpan({ cls: 'forge-meta-item forge-meta-priority', text: `P${element.priority}` });
      }

      if (element.dueDate) {
        const dueText = this.formatDateDisplay(element.dueDate, '📅');
        const due = line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-meta-due', text: dueText });
        const days = daysUntil(element.dueDate);
        if (days !== null && days < 0) due.addClass('forge-overdue');
        else if (days === 0) due.addClass('forge-due-today');
      } else if (this.dateDisplayMode === 'days-left') {
        line2.createSpan({ cls: 'forge-meta-item forge-meta-date forge-due-none', text: '📅 ∞' });
      }

      if (element.taskBlock) {
        const tb = this.plugin.index.getTaskBlock(element.taskBlock);
        const name = tb ? tb.name : element.taskBlock.split('/').pop()?.replace(/\.md$/, '') ?? '';
        line2.createSpan({ cls: 'forge-meta-item forge-meta-taskblock', text: `📦 ${name}` });
      }
    }
  }

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

    // ========== DATES SUBMENU ==========
    menu.addItem((item) => {
      item.setTitle('Dates').setIcon('calendar');
      const sub = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();

      sub.addItem((s: MenuItem) => {
        s.setTitle('Start date');
        s.setIcon('play');
        const sub2 = (s as MenuItem & { setSubmenu(): Menu }).setSubmenu();
        this.buildDateSubmenu(sub2, el, 'start_date', el.startDate);
      });

      sub.addItem((s: MenuItem) => {
        s.setTitle('Due date');
        s.setIcon('calendar-check');
        const sub2 = (s as MenuItem & { setSubmenu(): Menu }).setSubmenu();
        this.buildDateSubmenu(sub2, el, 'due_date', el.dueDate);
      });

      sub.addItem((s: MenuItem) => {
        s.setTitle('Review date');
        s.setIcon('calendar-clock');
        const sub2 = (s as MenuItem & { setSubmenu(): Menu }).setSubmenu();
        this.buildDateSubmenu(sub2, el, 'review_date', el.reviewDate);
      });
    });

    // Context selection
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

    // Task block selection
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

  /**
   * Показывает выпадающее меню настройки отображения полей.
   */
  private showDisplayOptionsMenu(anchor: HTMLElement): void {
    const menu = new Menu();

    // Режим отображения дат
    menu.addItem((item) => {
      item.setTitle('Date display mode').setIcon('calendar');
      const sub = (item as MenuItem & { setSubmenu(): Menu }).setSubmenu();

      sub.addItem((s: MenuItem) => {
        s.setTitle('Full dates (2026-06-15)');
        s.setChecked(this.dateDisplayMode === 'full');
        s.onClick(() => {
          this.dateDisplayMode = 'full';
          this.render();
        });
      });

      sub.addItem((s: MenuItem) => {
        s.setTitle('Days left (-3d, today, +7d)');
        s.setChecked(this.dateDisplayMode === 'days-left');
        s.onClick(() => {
          this.dateDisplayMode = 'days-left';
          this.render();
        });
      });
    });

    menu.addSeparator();

    // Видимость полей
    menu.addItem((item) => {
      item.setTitle('Show starred ⭐')
        .setChecked(this.showStarred)
        .onClick(() => {
          this.showStarred = !this.showStarred;
          this.render();
        });
    });

    menu.addItem((item) => {
      item.setTitle('Show story points')
        .setChecked(this.showStoryPoints)
        .onClick(() => {
          this.showStoryPoints = !this.showStoryPoints;
          this.render();
        });
    });

    menu.addItem((item) => {
      item.setTitle('Show priority')
        .setChecked(this.showPriority)
        .onClick(() => {
          this.showPriority = !this.showPriority;
          this.render();
        });
    });

    menu.showAtPosition({
      x: anchor.getBoundingClientRect().left,
      y: anchor.getBoundingClientRect().bottom + 4,
    });
  }

  private buildDateSubmenu(
    menu: Menu,
    el: ForgeElement,
    field: 'start_date' | 'due_date' | 'review_date',
    currentValue: string | null
  ): void {
    menu.addItem((item) => {
      item.setTitle('None');
      item.setChecked(currentValue === null);
      item.onClick(async () => {
        await this.mutate(`Clear ${field}`, [el.path], async () => {
          await this.plugin.parser.setDate(el.file, field, null);
        });
      });
    });

    menu.addSeparator();

    const presets = this.getDatePresets();
    for (const preset of presets) {
      menu.addItem((item) => {
        item.setTitle(preset.label);
        item.setChecked(currentValue === preset.value);
        item.onClick(async () => {
          await this.mutate(`Set ${field}`, [el.path], async () => {
            await this.plugin.parser.setDate(el.file, field, preset.value);
          });
        });
      });
    }

    menu.addSeparator();

    menu.addItem((item) => {
      item.setTitle('Custom date...');
      item.setIcon('calendar');
      item.onClick(() => {
        this.showCustomDateDialog(el, field, currentValue);
      });
    });
  }

  private getDatePresets(): { label: string; value: string }[] {
    const today = new Date();
    const fmt = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    return [
      { label: 'Today', value: fmt(today) },
      { label: 'Tomorrow', value: fmt(tomorrow) },
      { label: 'Next Week', value: fmt(nextWeek) },
      { label: 'Next Month', value: fmt(nextMonth) },
    ];
  }

  private showCustomDateDialog(
    el: ForgeElement,
    field: 'start_date' | 'due_date' | 'review_date',
    currentValue: string | null
  ): void {
    const overlay = document.createElement('div');
    overlay.addClass('forge-modal-overlay');

    const dialog = overlay.createDiv({ cls: 'forge-modal forge-date-modal' });

    const header = dialog.createDiv({ cls: 'forge-modal-header' });
    const fieldLabel =
      field === 'start_date' ? 'Start Date' : field === 'due_date' ? 'Due Date' : 'Review Date';
    header.createSpan({ text: `Set ${fieldLabel}` });

    const closeBtn = header.createDiv({ cls: 'forge-modal-close', text: '✕' });
    closeBtn.addEventListener('click', () => overlay.remove());

    const body = dialog.createDiv({ cls: 'forge-modal-body' });

    body.createDiv({ cls: 'forge-modal-label', text: `Enter date for "${el.title}"` });

    const inputRow = body.createDiv({ cls: 'forge-input-row' });
    const input = inputRow.createEl('input', {
      type: 'date',
      cls: 'forge-date-input',
      attr: { value: currentValue || '' },
    });

    const buttons = dialog.createDiv({ cls: 'forge-modal-buttons' });
    const saveBtn = buttons.createEl('button', { cls: 'mod-cta', text: 'Save' });
    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });

    const submit = async (): Promise<void> => {
      const value = input.value.trim();
      overlay.remove();
      await this.mutate(`Set ${field}`, [el.path], async () => {
        await this.plugin.parser.setDate(el.file, field, value || null);
      });
    };

    saveBtn.addEventListener('click', () => void submit());
    cancelBtn.addEventListener('click', () => overlay.remove());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        overlay.remove();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    input.focus();
  }

  async onClose(): Promise<void> {
    // no-op
  }
}