import { App, TFile } from 'obsidian';
import type ProjectsForgePlugin from '../main';

interface FileSnapshot {
  path: string;
  content: string | null; // null means the file did not exist
}

interface HistoryEntry {
  label: string;
  before: FileSnapshot[];
  after: FileSnapshot[];
}

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly limit = 5;
  private applying = false;

  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undoLabel(): string | null {
    return this.undoStack.length ? this.undoStack[this.undoStack.length - 1].label : null;
  }

  redoLabel(): string | null {
    return this.redoStack.length ? this.redoStack[this.redoStack.length - 1].label : null;
  }

  /**
   * Runs a mutating operation while recording an undoable snapshot.
   * `paths` are the files known to be affected. `work` may return extra
   * paths (e.g. a freshly created note's path).
   */
  async run(
    label: string,
    paths: string[],
    work: () => Promise<string[] | void> | string[] | void
  ): Promise<void> {
    if (this.applying) {
      await work();
      return;
    }

    const beforeMap = new Map<string, string | null>();
    for (const p of paths) beforeMap.set(p, await this.read(p));

    const extra = (await work()) || [];

    const all = new Set<string>([...paths, ...extra]);
    for (const p of extra) if (!beforeMap.has(p)) beforeMap.set(p, null);

    const before: FileSnapshot[] = [];
    const after: FileSnapshot[] = [];
    for (const p of all) {
      before.push({ path: p, content: beforeMap.has(p) ? (beforeMap.get(p) ?? null) : null });
      after.push({ path: p, content: await this.read(p) });
    }

    this.undoStack.push({ label, before, after });
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];

    await this.finish();
  }

  async undo(): Promise<void> {
    const entry = this.undoStack.pop();
    if (!entry) return;
    await this.apply(entry.before);
    this.redoStack.push(entry);
    if (this.redoStack.length > this.limit) this.redoStack.shift();
    await this.finish();
  }

  async redo(): Promise<void> {
    const entry = this.redoStack.pop();
    if (!entry) return;
    await this.apply(entry.after);
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    await this.finish();
  }

  private async finish(): Promise<void> {
    await this.plugin.index.build();
    this.plugin.refreshViews();
  }

  private async read(path: string): Promise<string | null> {
    const f = this.app.vault.getAbstractFileByPath(path);
    if (f instanceof TFile) return await this.app.vault.read(f);
    return null;
  }

  private async apply(snaps: FileSnapshot[]): Promise<void> {
    this.applying = true;
    try {
      // First handle deletions.
      for (const s of snaps) {
        if (s.content === null) {
          const f = this.app.vault.getAbstractFileByPath(s.path);
          if (f instanceof TFile) await this.app.vault.delete(f);
        }
      }
      // Then creations / modifications.
      for (const s of snaps) {
        if (s.content !== null) {
          const f = this.app.vault.getAbstractFileByPath(s.path);
          if (f instanceof TFile) {
            await this.app.vault.modify(f, s.content);
          } else {
            await this.ensureParentFolder(s.path);
            await this.app.vault.create(s.path, s.content);
          }
        }
      }
    } finally {
      this.applying = false;
    }
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const idx = path.lastIndexOf('/');
    if (idx < 0) return;
    const folder = path.slice(0, idx);
    if (this.app.vault.getAbstractFileByPath(folder)) return;
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