import { Scene } from 'phaser';
import { GRID_COLS, GRID_ROWS } from '../config/constants';
import { InputController } from '../input/InputController';
import { gridToWorld, TILE_HEIGHT, TILE_WIDTH, tileDepth } from '../iso/IsoMath';
import { createPlaceholderDiamondTexture } from '../util/PlaceholderFactory';

// M1: proves the iso projection, ground-tile rendering and camera pan/zoom.
// Buildings and enemies land in M2/M7 — the depth-sort formula they'll use
// (footprintDepth in IsoMath) is already verified against the plan's
// 2x2-building acceptance criterion via a unit test, ahead of anything
// existing to render it against.
export class WorldScene extends Scene {
    private inputController?: InputController;

    constructor() {
        super('World');
    }

    create() {
        createPlaceholderDiamondTexture(this, 'placeholder-tile', TILE_WIDTH, TILE_HEIGHT, 0x4a7c3f, 0x3a6230);

        this.buildGroundPlane();
        this.setupCamera();

        this.inputController = new InputController(this);

        this.events.once('shutdown', () => {
            this.inputController?.destroy();
        });
    }

    private buildGroundPlane(): void {
        for (let gridY = 0; gridY < GRID_ROWS; gridY++) {
            for (let gridX = 0; gridX < GRID_COLS; gridX++) {
                const { x, y } = gridToWorld(gridX, gridY);
                this.add.image(x, y, 'placeholder-tile').setDepth(tileDepth(gridX, gridY));
            }
        }
    }

    private setupCamera(): void {
        const corners = [
            gridToWorld(0, 0),
            gridToWorld(GRID_COLS - 1, 0),
            gridToWorld(0, GRID_ROWS - 1),
            gridToWorld(GRID_COLS - 1, GRID_ROWS - 1)
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
}
