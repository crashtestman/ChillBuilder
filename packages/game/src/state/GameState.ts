import { RESOURCES } from '../data/resources';

export interface PlacedBuilding {
    id: string;
    defId: string;
    gridX: number;
    gridY: number;
}

// The single authoritative game-state object the plan calls for. Only holds
// what M2 (resources, placed buildings) actually needs so far — population,
// faith and god-power fields join it in the milestones that introduce them,
// rather than sitting here unused ahead of time.
export interface GameState {
    resources: Record<string, number>;
    buildings: PlacedBuilding[];
}

export function createGameState(): GameState {
    const resources: Record<string, number> = {};
    for (const resource of Object.values(RESOURCES)) {
        resources[resource.id] = resource.startingAmount;
    }

    return { resources, buildings: [] };
}
