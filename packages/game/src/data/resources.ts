export interface ResourceDef {
    id: string;
    name: string;
    startingAmount: number;
    cap?: number;
}

export const RESOURCES: Record<string, ResourceDef> = {
    wood: { id: 'wood', name: 'Wood', startingAmount: 50 },
    gold: { id: 'gold', name: 'Gold', startingAmount: 20 }
};
