import { BUILDINGS } from '../data/buildings';
import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

// Faith per second = population * happiness * temple count * this rate.
// An unhappy or temple-less city generates no faith regardless of size —
// worship has to be earned, not just accumulated by existing.
const FAITH_RATE_PER_CAPITA_PER_TEMPLE_PER_SEC = 0.05;

export class WorshipSystem {
    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus
    ) {}

    update(deltaSeconds: number): void {
        const templeCount = this.countTemples();
        const { total: population, happiness } = this.gameState.population;

        const faithPerTick = population * happiness * templeCount * FAITH_RATE_PER_CAPITA_PER_TEMPLE_PER_SEC;
        this.gameState.worship.faithPerTick = faithPerTick;

        const generated = faithPerTick * deltaSeconds;
        if (generated <= 0) {
            return;
        }

        this.gameState.worship.faithTotal += generated;
        this.eventBus.emit('faith:generated', { amount: generated, total: this.gameState.worship.faithTotal });
    }

    private countTemples(): number {
        let count = 0;
        for (const building of this.gameState.buildings) {
            if (BUILDINGS[building.defId]?.isTemple) {
                count++;
            }
        }
        return count;
    }
}
