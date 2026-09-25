import type { BuildingDef } from '../data/buildings';

function formatCost(buildCost: Record<string, number>): string {
    return Object.entries(buildCost)
        .map(([resourceId, amount]) => `${amount} ${resourceId}`)
        .join(', ');
}

/**
 * DOM overlay (cheaper than in-canvas UI for scrollable/text-heavy controls,
 * and works the same under a later WebView/Electron shell) listing buildable
 * defs. Selecting one arms it for placement; WorldScene owns what "armed"
 * actually does (ghost preview, tap-to-place).
 */
export class BuildMenu {
    private readonly root: HTMLDivElement;
    private selectedButton: HTMLButtonElement | null = null;

    constructor(defs: BuildingDef[], onSelect: (defId: string) => void) {
        this.root = document.createElement('div');
        this.root.className = 'build-menu';

        for (const def of defs) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'build-menu__item';
            button.textContent = `${def.name} (${formatCost(def.buildCost)})`;
            button.addEventListener('click', () => {
                this.selectedButton?.classList.remove('build-menu__item--selected');
                button.classList.add('build-menu__item--selected');
                this.selectedButton = button;
                onSelect(def.id);
            });
            this.root.appendChild(button);
        }

        const uiRoot = document.getElementById('ui-root');
        (uiRoot ?? document.body).appendChild(this.root);
    }

    destroy(): void {
        this.root.remove();
    }
}
