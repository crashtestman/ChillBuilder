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

/**
 * Generates a rhombus texture matching the project's 2:1 iso tile ratio, so
 * ground tiles placed via IsoMath's projection tile edge-to-edge instead of
 * showing rectangular sprite bounds overlapping their neighbors.
 */
export function createPlaceholderDiamondTexture(
    scene: Scene,
    key: string,
    width: number,
    height: number,
    fillColor: number,
    strokeColor?: number
): void {
    if (scene.textures.exists(key)) {
        return;
    }

    const graphics = scene.add.graphics();
    graphics.fillStyle(fillColor, 1);
    if (strokeColor !== undefined) {
        graphics.lineStyle(2, strokeColor, 1);
    }
    graphics.beginPath();
    graphics.moveTo(width / 2, 0);
    graphics.lineTo(width, height / 2);
    graphics.lineTo(width / 2, height);
    graphics.lineTo(0, height / 2);
    graphics.closePath();
    graphics.fillPath();
    if (strokeColor !== undefined) {
        graphics.strokePath();
    }
    graphics.generateTexture(key, width, height);
    graphics.destroy();
}
