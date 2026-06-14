import { App, Notice, TFile } from 'obsidian';
import type ProjectsForgePlugin from '../main';

export class TaskMover {
  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  async move(childPath: string, newParentPath: string | null): Promise<void> {
    if (childPath === newParentPath) {
      new Notice('Cannot move an element into itself');
      return;
    }
    if (newParentPath && this.wouldCreateCycle(childPath, newParentPath)) {
      new Notice('Move rejected: this would create a cycle');
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(childPath);
    if (!(file instanceof TFile)) {
      new Notice('Element not found');
      return;
    }

    await this.plugin.history.run('Move element', [childPath], async () => {
      await this.plugin.parser.setParent(file, newParentPath);
    });
  }

  private wouldCreateCycle(childPath: string, newParentPath: string): boolean {
    let current: string | null = newParentPath;
    const guard = new Set<string>();
    while (current) {
      if (current === childPath) return true;
      if (guard.has(current)) break;
      guard.add(current);
      current = this.plugin.index.getParentPath(current);
    }
    return false;
  }
}