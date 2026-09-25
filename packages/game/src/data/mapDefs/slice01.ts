export interface GridCoord {
    gridX: number;
    gridY: number;
}

export interface MapDef {
    id: string;
    cols: number;
    rows: number;
    // blocked[gridY][gridX] — true means never buildable/walkable regardless
    // of building occupancy (e.g. water/decor). All open for the slice.
    blocked: boolean[][];
    spawn: GridCoord;
    cityCore: GridCoord;
}

const COLS = 16;
const ROWS = 16;

export const slice01: MapDef = {
    id: 'slice01',
    cols: COLS,
    rows: ROWS,
    blocked: Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false)),
    spawn: { gridX: 0, gridY: 0 },
    cityCore: { gridX: COLS - 1, gridY: ROWS - 1 }
};
