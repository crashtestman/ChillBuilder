import { Scene } from 'phaser';

// Boot has no preloader of its own, so keep anything loaded here tiny.
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.scene.start('Preload');
    }
}
