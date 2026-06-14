import { App, Modal, Notice, TFile, TFolder, normalizePath } from 'obsidian';
import type ProjectsForgePlugin from '../main';

export class ContextManager {
  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  openManager(): void {
    new ContextModal(this.app, this.plugin, this).open();
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

  async createContext(name: string): Promise<void> {
    const folder = normalizePath(this.plugin.settings.contextsFolder);
    await this.ensureFolder(folder);
    const base = this.sanitize(name) || 'context';
    let fullPath = `${folder}/${base}.md`;
    let i = 1;
    while (this.app.vault.getAbstractFileByPath(fullPath)) {
      fullPath = `${folder}/${base} ${i}.md`;
      i++;
    }
    const content = `---\nis_context: true\ntitle: "${name.replace(/"/g, '\\"')}"\n---\n`;
    await this.plugin.history.run('Create context', [], async () => {
      await this.app.vault.create(fullPath, content);
      return [fullPath];
    });
  }

  async deleteContext(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.plugin.history.run('Delete context', [path], async () => {
      await this.app.vault.delete(file);
    });
  }
}

class ContextModal extends Modal {
  constructor(app: App, private plugin: ProjectsForgePlugin, private manager: ContextManager) {
    super(app);
  }

  onOpen(): void {
    this.renderContent();
  }

  private renderContent(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('forge-context-modal');
    contentEl.createEl('h3', { text: 'Manage Contexts' });

    const inputRow = contentEl.createDiv({ cls: 'forge-context-input-row' });
    const input = inputRow.createEl('input', {
      type: 'text',
      attr: { placeholder: 'New context name (e.g. @home)' },
    });
    const addBtn = inputRow.createEl('button', { cls: 'mod-cta', text: 'Add' });

    const submit = async (): Promise<void> => {
      const value = input.value.trim();
      if (!value) return;
      await this.manager.createContext(value);
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
    const contexts = this.plugin.index.getAllContexts();
    if (contexts.length === 0) {
      list.createDiv({ cls: 'forge-empty', text: 'No contexts yet.' });
    }
    for (const ctx of contexts) {
      const row = list.createDiv({ cls: 'forge-context-row' });
      row.createSpan({ cls: 'forge-context-name', text: ctx.name });
      const del = row.createEl('button', { cls: 'forge-context-del', text: '🗑' });
      del.addEventListener('click', async () => {
        await this.manager.deleteContext(ctx.path);
        this.renderContent();
      });
    }
    input.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}