import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

/** DOM overlay showing remaining lives, kept live via 'city:damaged'. */
export class CityStatusBar {
    private readonly root: HTMLDivElement;
    private readonly eventBus: EventBus;
    private readonly livesValue: HTMLSpanElement;
    private readonly onCityDamaged = (payload: { lives: number }): void => {
        const text = payload.lives.toString();
        if (this.livesValue.textContent !== text) {
            this.livesValue.textContent = text;
        }
    };

    constructor(gameState: GameState, eventBus: EventBus, container?: HTMLElement) {
        this.eventBus = eventBus;
        this.root = document.createElement('div');
        this.root.className = 'city-status-bar';

        const item = document.createElement('div');
        item.className = 'city-status-bar__item';
        const label = document.createElement('span');
        label.className = 'city-status-bar__label';
        label.textContent = 'Lives';
        this.livesValue = document.createElement('span');
        this.livesValue.className = 'city-status-bar__value';
        this.livesValue.textContent = gameState.city.lives.toString();
        item.append(label, this.livesValue);
        this.root.appendChild(item);

        this.eventBus.on('city:damaged', this.onCityDamaged);

        const target = container ?? document.getElementById('ui-root') ?? document.body;
        target.appendChild(this.root);
    }

    destroy(): void {
        this.eventBus.off('city:damaged', this.onCityDamaged);
        this.root.remove();
    }
}
