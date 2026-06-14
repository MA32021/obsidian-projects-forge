import { App, PluginSettingTab, Setting } from 'obsidian';
import type ProjectsForgePlugin from '../main';

export interface ForgeSettings {
  elementsFolder: string;
  contextsFolder: string;
  taskBlocksFolder: string;
  defaultPriority: number;
  autoCollapse: boolean;
  showStoryPoints: boolean;
  smartViewEnabled: boolean;
  confirmBeforeDelete: boolean;
}

export const DEFAULT_SETTINGS: ForgeSettings = {
  elementsFolder: 'Forge/Elements',
  contextsFolder: 'Forge/Contexts',
  taskBlocksFolder: 'Forge/TaskBlocks',
  defaultPriority: 5,
  autoCollapse: false,
  showStoryPoints: true,
  smartViewEnabled: true,
  confirmBeforeDelete: true,
};

export class ForgeSettingTab extends PluginSettingTab {
  plugin: ProjectsForgePlugin;

  constructor(app: App, plugin: ProjectsForgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Projects Forge Settings' });

    new Setting(containerEl)
      .setName('Elements folder')
      .setDesc('Flat folder where all folders, projects and tasks are stored.')
      .addText((text) =>
        text
          .setPlaceholder('Forge/Elements')
          .setValue(this.plugin.settings.elementsFolder)
          .onChange(async (value) => {
            this.plugin.settings.elementsFolder = value.trim() || DEFAULT_SETTINGS.elementsFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Contexts folder')
      .setDesc('Folder where context notes are stored.')
      .addText((text) =>
        text
          .setPlaceholder('Forge/Contexts')
          .setValue(this.plugin.settings.contextsFolder)
          .onChange(async (value) => {
            this.plugin.settings.contextsFolder = value.trim() || DEFAULT_SETTINGS.contextsFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Task blocks folder')
      .setDesc('Folder where task-block notes are stored. A task may be assigned exactly one task block.')
      .addText((text) =>
        text
          .setPlaceholder('Forge/TaskBlocks')
          .setValue(this.plugin.settings.taskBlocksFolder)
          .onChange(async (value) => {
            this.plugin.settings.taskBlocksFolder = value.trim() || DEFAULT_SETTINGS.taskBlocksFolder;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Default priority')
      .setDesc('Default priority assigned to new actionable elements (0-10).')
      .addSlider((slider) =>
        slider
          .setLimits(0, 10, 1)
          .setValue(this.plugin.settings.defaultPriority)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.defaultPriority = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Auto-collapse completed branches')
      .setDesc('Automatically collapse projects/folders whose actionable status is done.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoCollapse).onChange(async (value) => {
          this.plugin.settings.autoCollapse = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName('Show Story Points')
      .setDesc('Display Story Points chips in the tree.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStoryPoints).onChange(async (value) => {
          this.plugin.settings.showStoryPoints = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName('Enable Smart View')
      .setDesc('Show the Smart View tab in the panel.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.smartViewEnabled).onChange(async (value) => {
          this.plugin.settings.smartViewEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        })
      );

    new Setting(containerEl)
      .setName('Confirm before delete')
      .setDesc('Ask for confirmation before deleting an element and its children.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.confirmBeforeDelete).onChange(async (value) => {
          this.plugin.settings.confirmBeforeDelete = value;
          await this.plugin.saveSettings();
        })
      );
  }
}