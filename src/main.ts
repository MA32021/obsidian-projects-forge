import { Plugin, WorkspaceLeaf, debounce } from 'obsidian';
import { ForgeSettings, DEFAULT_SETTINGS, ForgeSettingTab } from './settings/Settings';
import { TaskIndex } from './engine/TaskIndex';
import { TaskParser } from './engine/TaskParser';
import { ForgeTreeView, FORGE_TREE_VIEW_TYPE } from './views/ForgeTreeView';
import { TaskCreator } from './operations/TaskCreator';
import { TaskMover } from './operations/TaskMover';
import { ContextManager } from './operations/ContextManager';
import { TaskBlockManager } from './operations/TaskBlockManager';
import { HistoryManager } from './engine/HistoryManager';

export default class ProjectsForgePlugin extends Plugin {
  settings!: ForgeSettings;
  index!: TaskIndex;
  parser!: TaskParser;
  creator!: TaskCreator;
  mover!: TaskMover;
  contextManager!: ContextManager;
  taskBlockManager!: TaskBlockManager;
  history!: HistoryManager;

  private rebuild = debounce(
    async () => {
      await this.index.build();
      this.refreshViews();
    },
    400,
    true
  );

  async onload(): Promise<void> {
    await this.loadSettings();

    this.parser = new TaskParser(this.app, this);
    this.index = new TaskIndex(this.app, this);
    this.history = new HistoryManager(this.app, this);
    this.creator = new TaskCreator(this.app, this);
    this.mover = new TaskMover(this.app, this);
    this.contextManager = new ContextManager(this.app, this);
    this.taskBlockManager = new TaskBlockManager(this.app, this);

    this.registerView(
      FORGE_TREE_VIEW_TYPE,
      (leaf: WorkspaceLeaf) => new ForgeTreeView(leaf, this)
    );

    this.addRibbonIcon('hammer', 'Projects Forge', () => {
      void this.activateView();
    });

    this.addCommand({
      id: 'open-forge-panel',
      name: 'Open Forge panel',
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: 'forge-new-task',
      name: 'New task',
      callback: () => this.creator.create('task', null),
    });
    this.addCommand({
      id: 'forge-new-project',
      name: 'New project',
      callback: () => this.creator.create('project', null),
    });
    this.addCommand({
      id: 'forge-new-folder',
      name: 'New folder',
      callback: () => this.creator.create('folder', null),
    });
    this.addCommand({
      id: 'forge-undo',
      name: 'Undo last action',
      callback: () => void this.history.undo(),
    });
    this.addCommand({
      id: 'forge-redo',
      name: 'Redo last action',
      callback: () => void this.history.redo(),
    });
    this.addCommand({
      id: 'forge-refresh-index',
      name: 'Refresh index',
      callback: async () => {
        await this.index.build();
        this.refreshViews();
      },
    });

    this.addSettingTab(new ForgeSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(async () => {
      await this.index.build();
      this.refreshViews();
      this.registerVaultEvents();
    });
  }

  private registerVaultEvents(): void {
    this.registerEvent(this.app.vault.on('create', () => this.rebuild()));
    this.registerEvent(this.app.vault.on('delete', () => this.rebuild()));
    this.registerEvent(this.app.vault.on('rename', () => this.rebuild()));
    this.registerEvent(this.app.metadataCache.on('changed', () => this.rebuild()));
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(FORGE_TREE_VIEW_TYPE);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: FORGE_TREE_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(FORGE_TREE_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof ForgeTreeView) {
        view.render();
      }
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}