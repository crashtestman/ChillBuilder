import { Scene } from 'phaser';

/**
 * Generates simple colored-rectangle textures at runtime so gameplay code
 * never depends on real art existing. Swapping a placeholder for real art
 * later is just registering a texture under the same key via the loader
 * instead of calling this.
 */
export function createPlaceholderRectTexture(
    scene: Scene,
    key: string,
    width: number,
    height: number,
    color: number
): void {
    if (scene.textures.exists(key)) {
        return;
    }

    const graphics = scene.add.graphics();
    graphics.fillStyle(color, 1);
    graphics.fillRect(0, 0, width, height);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
}
