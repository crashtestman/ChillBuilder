import type { GameObjects } from 'phaser';
import { Scene } from 'phaser';
import { BUILDINGS } from '../data/buildings';
import { slice01 } from '../data/mapDefs/slice01';
import { InputController } from '../input/InputController';
import {
    DEPTH_LAYER_BUILDING,
    DEPTH_LAYER_GHOST,
    footprintDepth,
    type GridPoint,
    gridToWorld,
    TILE_HEIGHT,
    TILE_WIDTH,
    tileDepth,
    worldToNearestGrid
} from '../iso/IsoMath';
import { BuildingSystem } from '../systems/BuildingSystem';
import { EventBus } from '../state/EventBus';
import { createGameState, type GameState, type PlacedBuilding } from '../state/GameState';
import { BuildMenu } from '../ui/BuildMenu';
import { createPlaceholderDiamondTexture } from '../util/PlaceholderFactory';

const mapDef = slice01;

// M2: building placement — BuildMenu, ghost preview via inverse-projection,
// footprint/cost validation and the wall-off rule all live in
// BuildingSystem; this scene just renders whatever it decides.
export class WorldScene extends Scene {
    private inputController?: InputController;
    private buildMenu?: BuildMenu;
    private gameState!: GameState;
    private eventBus!: EventBus;
    private buildingSystem!: BuildingSystem;

    private selectedDefId: string | null = null;
    private ghostImages: GameObjects.Image[] = [];
    private lastHoverCell: GridPoint | null = null;

    constructor() {
        super('World');
    }

    create() {
        createPlaceholderDiamondTexture(this, 'placeholder-tile', TILE_WIDTH, TILE_HEIGHT, 0x4a7c3f, 0x3a6230);
        createPlaceholderDiamondTexture(this, 'placeholder-building', TILE_WIDTH, TILE_HEIGHT, 0x8a6d3f, 0x6b5230);
        createPlaceholderDiamondTexture(this, 'placeholder-ghost-ok', TILE_WIDTH, TILE_HEIGHT, 0x4a7cff);
        createPlaceholderDiamondTexture(this, 'placeholder-ghost-bad', TILE_WIDTH, TILE_HEIGHT, 0xd23b3b);

        this.gameState = createGameState();
        this.eventBus = new EventBus();
        this.buildingSystem = new BuildingSystem(this.gameState, this.eventBus, mapDef);
        this.eventBus.on('building:placed', ({ building }) => this.renderBuilding(building));

        this.buildGroundPlane();
        this.setupCamera();

        this.inputController = new InputController(this, {
            onTileTapped: (cell) => this.handleTileTapped(cell)
        });

        this.buildMenu = new BuildMenu(Object.values(BUILDINGS), (defId) => {
            this.selectedDefId = defId;
            this.lastHoverCell = null;
        });

        this.events.once('shutdown', () => {
            this.inputController?.destroy();
            this.buildMenu?.destroy();
        });
    }

    update(): void {
        this.updateGhostPreview();
    }

    private buildGroundPlane(): void {
        for (let gridY = 0; gridY < mapDef.rows; gridY++) {
            for (let gridX = 0; gridX < mapDef.cols; gridX++) {
                const { x, y } = gridToWorld(gridX, gridY);
                this.add.image(x, y, 'placeholder-tile').setDepth(tileDepth(gridX, gridY));
            }
        }
    }

    private setupCamera(): void {
        const corners = [
            gridToWorld(0, 0),
            gridToWorld(mapDef.cols - 1, 0),
            gridToWorld(0, mapDef.rows - 1),
            gridToWorld(mapDef.cols - 1, mapDef.rows - 1)
        ];
        const minX = Math.min(...corners.map((c) => c.x)) - TILE_WIDTH / 2;
        const maxX = Math.max(...corners.map((c) => c.x)) + TILE_WIDTH / 2;
        const minY = Math.min(...corners.map((c) => c.y)) - TILE_HEIGHT / 2;
        const maxY = Math.max(...corners.map((c) => c.y)) + TILE_HEIGHT / 2;

        const camera = this.cameras.main;
        // Padded so the grid's edge tiles can still be centered on screen
        // rather than clamping the camera hard against the grid bounds.
        camera.setBounds(
            minX - camera.width / 2,
            minY - camera.height / 2,
            maxX - minX + camera.width,
            maxY - minY + camera.height
        );
        camera.centerOn((minX + maxX) / 2, (minY + maxY) / 2);
    }

    private updateGhostPreview(): void {
        if (!this.selectedDefId) {
            this.clearGhost();
            return;
        }

        const pointer = this.input.activePointer;
        if (pointer.downTime === 0 && pointer.moveTime === 0) {
            // Pointer hasn't actually been used yet (fresh page load, or a
            // touch device before the first touch) — its x/y are Phaser
            // defaults, not a real cursor position.
            return;
        }
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const def = BUILDINGS[this.selectedDefId];
        // Same screen -> grid conversion InputController uses for taps, so
        // the ghost lines up exactly with what tapping there will do.
        const hovered = worldToNearestGrid(worldPoint.x, worldPoint.y);

        if (this.lastHoverCell && this.lastHoverCell.gridX === hovered.gridX && this.lastHoverCell.gridY === hovered.gridY) {
            return;
        }
        this.lastHoverCell = hovered;

        this.clearGhost();

        const check = this.buildingSystem.canPlace(this.selectedDefId, hovered.gridX, hovered.gridY);
        const textureKey = check.ok ? 'placeholder-ghost-ok' : 'placeholder-ghost-bad';
        // Its own layer, above DEPTH_LAYER_BUILDING: hovering an occupied
        // cell must show the ghost, not have it hidden by the building it's
        // warning you can't build on top of.
        const depth = footprintDepth(hovered.gridX, hovered.gridY, def.footprint.width, def.footprint.height, DEPTH_LAYER_GHOST);

        for (const ghostCell of this.buildingSystem.footprintCells(def, hovered.gridX, hovered.gridY)) {
            const { x, y } = gridToWorld(ghostCell.gridX, ghostCell.gridY);
            this.ghostImages.push(this.add.image(x, y, textureKey).setAlpha(0.6).setDepth(depth));
        }
    }

    private clearGhost(): void {
        for (const image of this.ghostImages) {
            image.destroy();
        }
        this.ghostImages = [];
    }

    private handleTileTapped(cell: GridPoint): void {
        if (!this.selectedDefId) {
            return;
        }

        const result = this.buildingSystem.place(this.selectedDefId, cell.gridX, cell.gridY);
        if (result.ok) {
            // Rendering happens via the 'building:placed' subscription in
            // create() — this just invalidates the ghost's cached hover
            // cell so it re-evaluates canPlace() now that this cell is
            // occupied (e.g. flips from ok to 'occupied' without moving).
            this.lastHoverCell = null;
        }
    }

    private renderBuilding(building: PlacedBuilding): void {
        const def = BUILDINGS[building.defId];
        const depth = footprintDepth(building.gridX, building.gridY, def.footprint.width, def.footprint.height, DEPTH_LAYER_BUILDING);

        for (const cell of this.buildingSystem.footprintCells(def, building.gridX, building.gridY)) {
            const { x, y } = gridToWorld(cell.gridX, cell.gridY);
            this.add.image(x, y, 'placeholder-building').setDepth(depth);
        }
    }
}
