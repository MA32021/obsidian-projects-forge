import { App, TFile } from 'obsidian';
import type ProjectsForgePlugin from '../main';
import { normalizeDate } from './PriorityEngine';

export type ForgeStatus = 'open' | 'done';

export interface ForgeElement {
  file: TFile;
  path: string;
  title: string;
  isFolder: boolean;
  isProject: boolean;
  status: ForgeStatus;
  parentPath: string | null;
  contexts: string[];
  taskBlock: string | null;
  priority: number;
  storyPoints: number | null;
  starred: boolean;
  startDate: string | null;
  dueDate: string | null;
  reviewDate: string | null;
  effort: string | null;
}

export interface ForgeContext {
  file: TFile;
  path: string;
  name: string;
}

export interface ForgeTaskBlock {
  file: TFile;
  path: string;
  name: string;
}

export interface TaskNode {
  element: ForgeElement;
  children: TaskNode[];
}

export class TaskIndex {
  private elements = new Map<string, ForgeElement>();
  private childrenMap = new Map<string, Set<string>>();
  private parentMap = new Map<string, string>();
  private contexts = new Map<string, ForgeContext>();
  private taskBlocks = new Map<string, ForgeTaskBlock>();

  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  async build(): Promise<void> {
    this.elements.clear();
    this.childrenMap.clear();
    this.parentMap.clear();
    this.contexts.clear();
    this.taskBlocks.clear();

    const elementsFolder = this.normalizeFolder(this.plugin.settings.elementsFolder);
    const contextsFolder = this.normalizeFolder(this.plugin.settings.contextsFolder);
    const taskBlocksFolder = this.normalizeFolder(this.plugin.settings.taskBlocksFolder);

    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isInFolder(file, contextsFolder)) {
        const ctx = this.parseSimple(file, 'is_context');
        if (ctx) this.contexts.set(ctx.path, ctx);
      }
      if (this.isInFolder(file, taskBlocksFolder)) {
        const tb = this.parseSimple(file, 'is_task_block');
        if (tb) this.taskBlocks.set(tb.path, tb);
      }
    }

    for (const file of files) {
      if (!this.isInFolder(file, elementsFolder)) continue;
      const el = this.plugin.parser.parseFile(file);
      if (!el) continue;
      this.elements.set(el.path, el);
    }

    for (const el of this.elements.values()) {
      if (el.parentPath && this.elements.has(el.parentPath)) {
        this.parentMap.set(el.path, el.parentPath);
        if (!this.childrenMap.has(el.parentPath)) {
          this.childrenMap.set(el.parentPath, new Set<string>());
        }
        this.childrenMap.get(el.parentPath)!.add(el.path);
      }
    }
  }

  private parseSimple(file: TFile, flag: string): ForgeContext | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || fm[flag] !== true) return null;
    const name =
      typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : file.basename;
    return { file, path: file.path, name };
  }

  private normalizeFolder(folder: string): string {
    return folder.replace(/^\/+|\/+$/g, '');
  }

  private isInFolder(file: TFile, folder: string): boolean {
    if (!folder) return true;
    return file.path === `${folder}/${file.name}` || file.path.startsWith(`${folder}/`);
  }

  getElement(path: string): ForgeElement | undefined {
    return this.elements.get(path);
  }

  getAllElements(): ForgeElement[] {
    return Array.from(this.elements.values());
  }

  getParentPath(path: string): string | null {
    return this.parentMap.get(path) ?? null;
  }

  getChildrenPaths(path: string): string[] {
    return Array.from(this.childrenMap.get(path) ?? []);
  }

  /** Returns the element plus all of its descendants (depth-first). */
  getSubtreePaths(path: string): string[] {
    const result: string[] = [path];
    for (const child of this.getChildrenPaths(path)) {
      result.push(...this.getSubtreePaths(child));
    }
    return result;
  }

  /** True if any descendant is an actionable element with status "open". */
  hasOpenDescendant(path: string): boolean {
    for (const childPath of this.getChildrenPaths(path)) {
      const child = this.elements.get(childPath);
      if (!child) continue;
      if (!child.isFolder && child.status === 'open') return true;
      if (this.hasOpenDescendant(childPath)) return true;
    }
    return false;
  }

  getRoots(): ForgeElement[] {
    return this.getAllElements().filter((el) => !this.parentMap.has(el.path));
  }

  getTree(): TaskNode[] {
    return this.buildNodes(this.getRoots());
  }

  private buildNodes(elements: ForgeElement[]): TaskNode[] {
    const sorted = [...elements].sort(TaskIndex.compareElements);
    return sorted.map((el) => {
      const childPaths = this.getChildrenPaths(el.path);
      const childElements = childPaths
        .map((p) => this.elements.get(p))
        .filter((e): e is ForgeElement => !!e);
      return { element: el, children: this.buildNodes(childElements) };
    });
  }

  static compareElements(a: ForgeElement, b: ForgeElement): number {
    const rank = (el: ForgeElement): number => (el.isFolder ? 0 : el.isProject ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  }

  getAllContexts(): ForgeContext[] {
    return Array.from(this.contexts.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }

  getContext(path: string): ForgeContext | undefined {
    return this.contexts.get(path);
  }

  getAllTaskBlocks(): ForgeTaskBlock[] {
    return Array.from(this.taskBlocks.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }

  getTaskBlock(path: string): ForgeTaskBlock | undefined {
    return this.taskBlocks.get(path);
  }
}