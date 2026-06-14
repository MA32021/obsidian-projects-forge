import { App, TFile } from 'obsidian';
import type ProjectsForgePlugin from '../main';
import { ForgeElement, ForgeStatus } from './TaskIndex';
import { normalizeDate } from './PriorityEngine';

export type ElementType = 'task' | 'project' | 'folder';

export class TaskParser {
  constructor(private app: App, private plugin: ProjectsForgePlugin) {}

  parseFile(file: TFile): ForgeElement | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (!fm || fm.pf_element !== true) return null;

    const isFolder = fm.is_folder === true;
    const isProject = fm.is_project === true;
    const title =
      typeof fm.title === 'string' && fm.title.trim() ? fm.title.trim() : file.basename;
    const status: ForgeStatus = fm.status === 'done' ? 'done' : 'open';
    const parentPath = this.resolveLinkToPath(fm['pf-parent'], file.path);

    const contexts: string[] = [];
    const rawCtx = fm.context;
    if (Array.isArray(rawCtx)) {
      for (const item of rawCtx) {
        const p = this.resolveLinkToPath(item, file.path);
        if (p) contexts.push(p);
      }
    } else if (typeof rawCtx === 'string') {
      const p = this.resolveLinkToPath(rawCtx, file.path);
      if (p) contexts.push(p);
    }

    const taskBlock = this.resolveLinkToPath(fm['task-block'], file.path);

    const priority =
      typeof fm.priority === 'number' ? fm.priority : this.plugin.settings.defaultPriority;
    const storyPoints = typeof fm.story_points === 'number' ? fm.story_points : null;

    return {
      file,
      path: file.path,
      title,
      isFolder,
      isProject,
      status,
      parentPath,
      contexts,
      taskBlock,
      priority,
      storyPoints,
      starred: fm.starred === true,
      startDate: normalizeDate(fm.start_date),
      dueDate: normalizeDate(fm.due_date),
      reviewDate: normalizeDate(fm.review_date),
      effort: typeof fm.effort === 'string' ? fm.effort : null,
    };
  }

  resolveLinkToPath(raw: unknown, sourcePath: string): string | null {
    if (raw === null || raw === undefined) return null;
    let link = String(raw).trim();
    if (!link) return null;
    const m = link.match(/^\[\[(.+?)(?:\|.*)?\]\]$/);
    if (m) link = m[1].trim();
    const dest = this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
    if (dest) return dest.path;
    if (!link.endsWith('.md')) link = link + '.md';
    return link;
  }

  static pathToLink(path: string): string {
    const noExt = path.replace(/\.md$/, '');
    return `[[${noExt}]]`;
  }

  async setStatus(file: TFile, status: ForgeStatus): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.status = status;
    });
  }

  async setStoryPoints(file: TFile, value: number | null): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (value === null) delete fm.story_points;
      else fm.story_points = value;
    });
  }

  async toggleStar(file: TFile, value: boolean): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.starred = value;
    });
  }

  async setParent(file: TFile, parentPath: string | null): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (parentPath === null) delete fm['pf-parent'];
      else fm['pf-parent'] = TaskParser.pathToLink(parentPath);
    });
  }

  async setContexts(file: TFile, contexts: string[]): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (contexts.length === 0) delete fm.context;
      else fm.context = contexts.map((c) => TaskParser.pathToLink(c));
    });
  }

  /** A task can hold exactly one task block (single value, not array). */
  async setTaskBlock(file: TFile, path: string | null): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (path === null) delete fm['task-block'];
      else fm['task-block'] = TaskParser.pathToLink(path);
    });
  }

  async setTitle(file: TFile, title: string): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.title = title;
    });
  }

  async setDate(
    file: TFile,
    field: 'start_date' | 'due_date' | 'review_date',
    value: string | null
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (value === null) delete fm[field];
      else fm[field] = value;
    });
  }

  async convertType(file: TFile, type: ElementType): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm.is_folder = type === 'folder';
      fm.is_project = type === 'project';
      if (type === 'folder') {
        delete fm.status;
        delete fm.starred;
        delete fm.priority;
        delete fm.story_points;
        delete fm['task-block'];
      } else {
        if (fm.status !== 'done' && fm.status !== 'open') fm.status = 'open';
        if (typeof fm.priority !== 'number') fm.priority = this.plugin.settings.defaultPriority;
        if (typeof fm.starred !== 'boolean') fm.starred = false;
      }
    });
  }
}