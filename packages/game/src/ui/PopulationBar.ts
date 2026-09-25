import type { EventBus } from '../state/EventBus';
import type { GameState, PopulationState } from '../state/GameState';

function formatTotal(total: number): string {
    // Ceil (not floor/round) once growth has actually started: population
    // is a continuous value under the hood, and flooring reads as "still
    // zero" for the first few seconds after a house goes up even while
    // food is visibly draining to feed the (fractional) population.
    return total > 0 ? Math.ceil(total).toString() : '0';
}

function formatHappiness(happiness: number): string {
    return `${Math.round(happiness * 100)}%`;
}

/** DOM overlay showing population + happiness, kept live via 'population:changed'. */
export class PopulationBar {
    private readonly root: HTMLDivElement;
    private readonly eventBus: EventBus;
    private readonly totalValue: HTMLSpanElement;
    private readonly happinessValue: HTMLSpanElement;
    private readonly onPopulationChanged = (payload: PopulationState): void => {
        const totalText = formatTotal(payload.total);
        if (this.totalValue.textContent !== totalText) {
            this.totalValue.textContent = totalText;
        }
        const happinessText = formatHappiness(payload.happiness);
        if (this.happinessValue.textContent !== happinessText) {
            this.happinessValue.textContent = happinessText;
        }
    };

    constructor(gameState: GameState, eventBus: EventBus) {
        this.eventBus = eventBus;
        this.root = document.createElement('div');
        this.root.className = 'population-bar';

        const popItem = document.createElement('div');
        popItem.className = 'population-bar__item';
        const popLabel = document.createElement('span');
        popLabel.className = 'population-bar__label';
        popLabel.textContent = 'Population';
        this.totalValue = document.createElement('span');
        this.totalValue.className = 'population-bar__value';
        this.totalValue.textContent = formatTotal(gameState.population.total);
        popItem.append(popLabel, this.totalValue);

        const happinessItem = document.createElement('div');
        happinessItem.className = 'population-bar__item';
        const happinessLabel = document.createElement('span');
        happinessLabel.className = 'population-bar__label';
        happinessLabel.textContent = 'Happiness';
        this.happinessValue = document.createElement('span');
        this.happinessValue.className = 'population-bar__value';
        this.happinessValue.textContent = formatHappiness(gameState.population.happiness);
        happinessItem.append(happinessLabel, this.happinessValue);

        this.root.append(popItem, happinessItem);

        this.eventBus.on('population:changed', this.onPopulationChanged);

        const uiRoot = document.getElementById('ui-root');
        (uiRoot ?? document.body).appendChild(this.root);
    }

    destroy(): void {
        this.eventBus.off('population:changed', this.onPopulationChanged);
        this.root.remove();
    }
}
