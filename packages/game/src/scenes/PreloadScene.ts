import { Scene } from 'phaser';

// No real assets to load yet — placeholder textures are generated at runtime
// (see util/PlaceholderFactory). This scene exists as the seam where a real
// asset manifest will be loaded later without touching Boot or World.
export class PreloadScene extends Scene {
    constructor() {
        super('Preload');
    }

    create() {
        this.scene.start('World');
    }
}
