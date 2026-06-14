import { App, Modal, Notice } from 'obsidian';

export class PromptModal extends Modal {
  private value: string;

  constructor(
    app: App,
    private heading: string,
    initial: string,
    private onSubmit: (value: string) => void | Promise<void>
  ) {
    super(app);
    this.value = initial;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('forge-create-modal');
    contentEl.createEl('h3', { text: this.heading });

    const input = contentEl.createEl('input', {
      type: 'text',
      cls: 'forge-create-input',
    });
    input.value = this.value;
    input.focus();
    input.select();
    input.addEventListener('input', () => (this.value = input.value));

    const buttons = contentEl.createDiv({ cls: 'forge-create-buttons' });
    const okBtn = buttons.createEl('button', { cls: 'mod-cta', text: 'Save' });
    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });

    const submit = (): void => {
      const v = this.value.trim();
      if (!v) {
        new Notice('Name cannot be empty');
        input.focus();
        return;
      }
      void this.onSubmit(v);
      this.close();
    };

    okBtn.addEventListener('click', submit);
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