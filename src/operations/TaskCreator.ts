import { App, Modal, Notice, TFolder, normalizePath } from 'obsidian';
import type ProjectsForgePlugin from '../main';
import { ElementType, TaskParser } from '../engine/TaskParser';
import { ForgeContext, ForgeTaskBlock } from '../engine/TaskIndex';

export class TaskCreator {
  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  create(type: ElementType, parentPath: string | null): void {
    const contexts = this.plugin.index.getAllContexts();
    const taskBlocks = this.plugin.index.getAllTaskBlocks();
    new CreateModal(this.app, type, contexts, taskBlocks, async (title, ctxs, taskBlock) => {
      await this.createElement(type, title, parentPath, ctxs, taskBlock);
    }).open();
  }

  private async createElement(
    type: ElementType,
    title: string,
    parentPath: string | null,
    contexts: string[],
    taskBlock: string | null
  ): Promise<void> {
    const folder = normalizePath(this.plugin.settings.elementsFolder);
    await this.ensureFolder(folder);

    const base = this.sanitize(title) || 'Untitled';
    let fileName = `${base}.md`;
    let fullPath = `${folder}/${fileName}`;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(fullPath)) {
      fileName = `${base} ${i}.md`;
      fullPath = `${folder}/${fileName}`;
      i++;
    }

    const content = this.buildFrontmatter(type, title, parentPath, contexts, taskBlock);

    await this.plugin.history.run(`Create ${type}`, [], async () => {
      await this.app.vault.create(fullPath, content);
      return [fullPath];
    });

    new Notice(`Created ${type}: ${title}`);
  }

  private buildFrontmatter(
    type: ElementType,
    title: string,
    parentPath: string | null,
    contexts: string[],
    taskBlock: string | null
  ): string {
    const lines: string[] = ['---'];
    lines.push('pf_element: true');
    lines.push(`title: "${this.escapeYaml(title)}"`);
    lines.push(`is_folder: ${type === 'folder'}`);
    lines.push(`is_project: ${type === 'project'}`);
    if (type !== 'folder') {
      lines.push('status: open');
      lines.push(`priority: ${this.plugin.settings.defaultPriority}`);
      lines.push('starred: false');
    }
    if (parentPath) {
      lines.push(`pf-parent: "${TaskParser.pathToLink(parentPath)}"`);
    }
    if (contexts.length > 0) {
      lines.push('context:');
      for (const c of contexts) lines.push(`  - "${TaskParser.pathToLink(c)}"`);
    }
    if (type !== 'folder' && taskBlock) {
      lines.push(`task-block: "${TaskParser.pathToLink(taskBlock)}"`);
    }
    lines.push('---');
    lines.push('');
    return lines.join('\n');
  }

  private escapeYaml(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private sanitize(name: string): string {
    return name.replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
  }

  private async ensureFolder(folder: string): Promise<void> {
    if (this.app.vault.getAbstractFileByPath(folder) instanceof TFolder) return;
    const parts = folder.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }
}

export class CreateModal extends Modal {
  private titleValue = '';
  private selectedContexts = new Set<string>();
  private selectedTaskBlock: string | null = null;

  constructor(
    app: App,
    private type: ElementType,
    private contexts: ForgeContext[],
    private taskBlocks: ForgeTaskBlock[],
    private onSubmit: (
      title: string,
      contexts: string[],
      taskBlock: string | null
    ) => void | Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('forge-create-modal');

    const titleLabel =
      this.type === 'task' ? 'New Task' : this.type === 'project' ? 'New Project' : 'New Folder';
    contentEl.createEl('h3', { text: titleLabel });

    const input = contentEl.createEl('input', {
      type: 'text',
      cls: 'forge-create-input',
      attr: { placeholder: 'Title...' },
    });
    input.focus();
    input.addEventListener('input', () => (this.titleValue = input.value));

    if (this.type !== 'folder' && this.contexts.length > 0) {
      contentEl.createEl('div', { cls: 'forge-create-label', text: 'Contexts' });
      const grid = contentEl.createDiv({ cls: 'forge-context-grid' });
      for (const ctx of this.contexts) {
        const chip = grid.createDiv({ cls: 'forge-context-chip', text: ctx.name });
        chip.addEventListener('click', () => {
          if (this.selectedContexts.has(ctx.path)) {
            this.selectedContexts.delete(ctx.path);
            chip.removeClass('forge-context-chip-active');
          } else {
            this.selectedContexts.add(ctx.path);
            chip.addClass('forge-context-chip-active');
          }
        });
      }
    }

    if (this.type !== 'folder' && this.taskBlocks.length > 0) {
      contentEl.createEl('div', { cls: 'forge-create-label', text: 'Task block (single)' });
      const grid = contentEl.createDiv({ cls: 'forge-context-grid' });
      const chips = new Map<string, HTMLElement>();
      for (const tb of this.taskBlocks) {
        const chip = grid.createDiv({ cls: 'forge-context-chip forge-taskblock-chip', text: tb.name });
        chips.set(tb.path, chip);
        chip.addEventListener('click', () => {
          if (this.selectedTaskBlock === tb.path) {
            this.selectedTaskBlock = null;
            chip.removeClass('forge-context-chip-active');
          } else {
            this.selectedTaskBlock = tb.path;
            chips.forEach((c) => c.removeClass('forge-context-chip-active'));
            chip.addClass('forge-context-chip-active');
          }
        });
      }
    }

    const buttons = contentEl.createDiv({ cls: 'forge-create-buttons' });
    const createBtn = buttons.createEl('button', { cls: 'mod-cta', text: 'Create' });
    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });

    const submit = (): void => {
      const value = this.titleValue.trim();
      if (!value) {
        new Notice('Title cannot be empty');
        input.focus();
        return;
      }
      void this.onSubmit(value, Array.from(this.selectedContexts), this.selectedTaskBlock);
      this.close();
    };

    createBtn.addEventListener('click', submit);
    cancelBtn.addEventListener('click', () => this.close());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}