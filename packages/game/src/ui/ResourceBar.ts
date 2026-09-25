import { RESOURCES } from '../data/resources';
import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

function formatAmount(amount: number): string {
    return Math.floor(amount).toString();
}

/**
 * DOM overlay showing each resource's current amount, kept live via
 * EventBus's 'resource:changed' rather than polling GameState every frame.
 */
export class ResourceBar {
    private readonly root: HTMLDivElement;
    private readonly eventBus: EventBus;
    private readonly valueElements = new Map<string, HTMLSpanElement>();
    private readonly onResourceChanged = (payload: { resourceId: string; amount: number }): void => {
        const element = this.valueElements.get(payload.resourceId);
        if (!element) {
            return;
        }
        // A producing building emits every frame, but Math.floor means most
        // of those frames round to the same displayed value — skip the
        // write rather than touching the DOM ~60x/sec for no visible change.
        const formatted = formatAmount(payload.amount);
        if (element.textContent !== formatted) {
            element.textContent = formatted;
        }
    };

    constructor(gameState: GameState, eventBus: EventBus, container?: HTMLElement) {
        this.eventBus = eventBus;
        this.root = document.createElement('div');
        this.root.className = 'resource-bar';

        for (const resource of Object.values(RESOURCES)) {
            const item = document.createElement('div');
            item.className = 'resource-bar__item';

            const label = document.createElement('span');
            label.className = 'resource-bar__label';
            label.textContent = resource.name;

            const value = document.createElement('span');
            value.className = 'resource-bar__value';
            value.textContent = formatAmount(gameState.resources[resource.id] ?? 0);

            item.append(label, value);
            this.root.appendChild(item);
            this.valueElements.set(resource.id, value);
        }

        this.eventBus.on('resource:changed', this.onResourceChanged);

        const target = container ?? document.getElementById('ui-root') ?? document.body;
        target.appendChild(this.root);
    }

    destroy(): void {
        this.eventBus.off('resource:changed', this.onResourceChanged);
        this.root.remove();
    }
}
