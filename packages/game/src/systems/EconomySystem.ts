import { BUILDINGS } from '../data/buildings';
import type { EventBus } from '../state/EventBus';
import type { GameState } from '../state/GameState';

// Ticks every placed building's produces/consumes rates (per second) into
// GameState.resources. Consumption never drives a resource below zero —
// a building just produces/consumes less than its rate implies once a
// shortfall hits zero, rather than the vertical slice needing a real
// shortage/backpressure mechanic yet.
export class EconomySystem {
    constructor(
        private readonly gameState: GameState,
        private readonly eventBus: EventBus
    ) {}

    update(deltaSeconds: number): void {
        const deltas = new Map<string, number>();

        for (const building of this.gameState.buildings) {
            const def = BUILDINGS[building.defId];
            if (!def) {
                continue;
            }
            this.accumulate(deltas, def.produces, deltaSeconds);
            this.accumulate(deltas, def.consumes, -deltaSeconds);
        }

        for (const [resourceId, delta] of deltas) {
            this.applyDelta(resourceId, delta);
        }
    }

    private accumulate(
        deltas: Map<string, number>,
        rates: Record<string, number> | undefined,
        deltaSeconds: number
    ): void {
        if (!rates) {
            return;
        }
        for (const [resourceId, ratePerSecond] of Object.entries(rates)) {
            deltas.set(resourceId, (deltas.get(resourceId) ?? 0) + ratePerSecond * deltaSeconds);
        }
    }

    private applyDelta(resourceId: string, delta: number): void {
        const current = this.gameState.resources[resourceId] ?? 0;
        const next = Math.max(0, current + delta);
        if (next === current) {
            return;
        }
        this.gameState.resources[resourceId] = next;
        this.eventBus.emit('resource:changed', { resourceId, amount: next });
    }
}
