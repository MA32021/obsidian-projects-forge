import { App, Modal, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import type ProjectsForgePlugin from '../main';

export class TaskBlockManager {
  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  openManager(): void {
    new TaskBlockModal(this.app, this.plugin, this).open();
  }

  private async ensureFolder(folder: string): Promise<void> {
    const path = normalizePath(folder);
    if (this.app.vault.getAbstractFileByPath(path) instanceof TFolder) return;
    const parts = path.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private sanitize(name: string): string {
    return name.replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
  }

  async createTaskBlock(name: string): Promise<void> {
    const folder = normalizePath(this.plugin.settings.taskBlocksFolder);
    await this.ensureFolder(folder);
    const base = this.sanitize(name) || 'block';
    let fullPath = `${folder}/${base}.md`;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(fullPath)) {
      fullPath = `${folder}/${base} ${i}.md`;
      i++;
    }
    const content = `---\nis_task_block: true\ntitle: "${name.replace(/"/g, '\\"')}"\n---\n`;
    await this.plugin.history.run('Create task block', [], async () => {
      await this.app.vault.create(fullPath, content);
      return [fullPath];
    });
  }

  async deleteTaskBlock(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.plugin.history.run('Delete task block', [path], async () => {
      await this.app.vault.delete(file);
    });
  }
}

class TaskBlockModal extends Modal {
  constructor(app: App, private plugin: ProjectsForgePlugin, private manager: TaskBlockManager) {
    super(app);
  }

  onOpen(): void {
    this.renderContent();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('forge-context-modal');
    contentEl.createEl('h3', { text: 'Manage Task Blocks' });

    const inputRow = contentEl.createDiv({ cls: 'forge-context-input-row' });
    const input = inputRow.createEl('input', {
      type: 'text',
      attr: { placeholder: 'New task block name (e.g. Sprint 12)' },
    });
    const addBtn = inputRow.createEl('button', { cls: 'mod-cta', text: 'Add' });

    const submit = async (): Promise<void> => {
      const value = input.value.trim();
      if (!value) return;
      await this.manager.createTaskBlock(value);
      this.renderContent();
    };
    addBtn.addEventListener('click', () => void submit());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void submit();
      }
    });

    const list = contentEl.createDiv({ cls: 'forge-context-list' });
    const blocks = this.plugin.index.getAllTaskBlocks();
    if (blocks.length === 0) {
      list.createDiv({ cls: 'forge-empty', text: 'No task blocks yet.' });
    }
    for (const tb of blocks) {
      const row = list.createDiv({ cls: 'forge-context-row' });
      row.createSpan({ cls: 'forge-context-name', text: tb.name });
      const del = row.createEl('button', { cls: 'forge-context-del', text: '🗑' });
      del.addEventListener('click', async () => {
        await this.manager.deleteTaskBlock(tb.path);
        this.renderContent();
      });
    }
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}