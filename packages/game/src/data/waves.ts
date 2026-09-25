export interface WaveDef {
    id: string;
    enemyDefId: string;
    count: number;
    spawnIntervalSeconds: number;
    startDelaySeconds: number;
}

// The vertical slice needs exactly one wave (per the plan).
export const WAVES: WaveDef[] = [
    {
        id: 'wave1',
        enemyDefId: 'raider',
        count: 6,
        spawnIntervalSeconds: 2,
        startDelaySeconds: 10
    }
];
