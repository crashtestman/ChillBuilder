export interface ResourceDef {
    id: string;
    name: string;
    startingAmount: number;
    cap?: number;
}

export const RESOURCES: Record<string, ResourceDef> = {
    wood: { id: 'wood', name: 'Wood', startingAmount: 50 },
    // Nothing in the slice produces gold — it's spend-once starting capital,
    // not an income stream. 40 is the minimum that lets a real playthrough
    // afford two Watchtowers (40 gold total): with one, live-tested combat
    // only kills 2 of 6 raiders; with two well-placed, a full 6/6 clean
    // defense is achievable. At the old 20, "win" was structurally
    // unreachable — verified live before picking this number.
    gold: { id: 'gold', name: 'Gold', startingAmount: 40 },
    food: { id: 'food', name: 'Food', startingAmount: 20 }
};
