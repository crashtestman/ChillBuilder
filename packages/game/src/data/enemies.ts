export interface EnemyDef {
    id: string;
    name: string;
    maxHealth: number;
    // World pixels/second, not grid-cells/second — sidesteps converting a
    // "cells per second" figure through the iso projection, since a
    // constant pixel speed already moves at a constant rate regardless of
    // which of the 4 directions a path segment runs.
    speed: number;
}

export const ENEMIES: Record<string, EnemyDef> = {
    raider: {
        id: 'raider',
        name: 'Raider',
        maxHealth: 20,
        speed: 100
    }
};
