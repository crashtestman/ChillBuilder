import { BUILDINGS } from '../data/buildings';
import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

const FOOD_PER_CAPITA_PER_SEC = 0.1;
// Food stockpile per capita counted as "fully fed" for happiness purposes —
// growth draws down this buffer, so sustained growth needs food production
// (farms) to keep up, not just a one-time stockpile.
const FOOD_BUFFER_PER_CAPITA = 5;
// Fraction of the gap to housing capacity closed per second, at full
// happiness (scales linearly down to ~0 as happiness approaches 0).
const GROWTH_RATE_PER_SEC = 0.1;
const STARVATION_HAPPINESS_THRESHOLD = 0.1;
const STARVATION_SHRINK_RATE_PER_SEC = 0.05;

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
}

// Grows population toward available housing, gated by happiness (itself
// derived from the food buffer relative to population) — a starving
// population stops growing and shrinks instead. Population also consumes
// food itself, independent of EconomySystem's building production/
// consumption, since food upkeep is a population concern, not a building
// one.
export class PopulationSystem {
    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus
    ) {}

    update(deltaSeconds: number): void {
        this.consumeFood(deltaSeconds);

        const happiness = this.computeHappiness();
        const total = this.computeNextTotal(deltaSeconds, happiness);

        const changed = happiness !== this.gameState.population.happiness || total !== this.gameState.population.total;
        this.gameState.population.happiness = happiness;
        this.gameState.population.total = total;

        if (changed) {
            this.eventBus.emit('population:changed', { ...this.gameState.population });
        }
    }

    housingCapacity(): number {
        let capacity = 0;
        for (const building of this.gameState.buildings) {
            capacity += BUILDINGS[building.defId]?.housingCapacity ?? 0;
        }
        return capacity;
    }

    private consumeFood(deltaSeconds: number): void {
        const demand = this.gameState.population.total * FOOD_PER_CAPITA_PER_SEC * deltaSeconds;
        if (demand <= 0) {
            return;
        }

        const current = this.gameState.resources.food ?? 0;
        const next = Math.max(0, current - demand);
        if (next === current) {
            return;
        }
        this.gameState.resources.food = next;
        this.eventBus.emit('resource:changed', { resourceId: 'food', amount: next });
    }

    private computeHappiness(): number {
        const population = this.gameState.population.total;
        if (population <= 0) {
            return 1;
        }
        const food = this.gameState.resources.food ?? 0;
        return clamp01(food / (population * FOOD_BUFFER_PER_CAPITA));
    }

    private computeNextTotal(deltaSeconds: number, happiness: number): number {
        const current = this.gameState.population.total;

        if (happiness < STARVATION_HAPPINESS_THRESHOLD) {
            return Math.max(0, current - current * STARVATION_SHRINK_RATE_PER_SEC * deltaSeconds);
        }

        const capacity = this.housingCapacity();
        if (current < capacity) {
            return Math.min(capacity, current + (capacity - current) * GROWTH_RATE_PER_SEC * happiness * deltaSeconds);
        }

        return current;
    }
}
