export class StoryPointsPicker {
  static readonly VALUES: number[] = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];

  static show(
    anchor: HTMLElement,
    current: number | null,
    onSelect: (value: number | null) => void
  ): void {
    document.querySelectorAll('.forge-sp-picker').forEach((el) => el.remove());

    const menu = document.createElement('div');
    menu.addClass('forge-sp-picker');

    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;

    const close = (): void => {
      menu.remove();
      document.removeEventListener('mousedown', onOutside, true);
    };

    const onOutside = (evt: MouseEvent): void => {
      if (!menu.contains(evt.target as Node)) {
        close();
      }
    };

    for (const value of StoryPointsPicker.VALUES) {
      const item = menu.createDiv({ cls: 'forge-sp-item', text: String(value) });
      if (value === current) item.addClass('forge-sp-item-active');
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
        onSelect(value);
      });
    }

    const clear = menu.createDiv({ cls: 'forge-sp-item forge-sp-clear', text: 'Clear' });
    clear.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
      onSelect(null);
    });

    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
    }, 0);
  }
}