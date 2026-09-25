import { Scene } from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/constants';
import { createPlaceholderRectTexture } from '../util/PlaceholderFactory';

// Scaffolding-only placeholder. The isometric grid, camera controls and
// gameplay systems land in later milestones — this scene just proves the
// Boot -> Preload -> World pipeline boots and renders under Phaser 4.
export class WorldScene extends Scene {
    constructor() {
        super('World');
    }

    create() {
        createPlaceholderRectTexture(this, 'placeholder-tile', 64, 64, 0x4a7c3f);

        this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'placeholder-tile');

        this.add
            .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60, 'ChillBuilder', {
                fontFamily: 'Arial',
                fontSize: 32,
                color: '#f4e8d0'
            })
            .setOrigin(0.5);
    }
}
