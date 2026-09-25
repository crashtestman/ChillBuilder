import { Math as PhaserMath, type Cameras, type Input, type Scene } from 'phaser';

export interface InputControllerConfig {
    minZoom?: number;
    maxZoom?: number;
    wheelZoomStep?: number;
}

/**
 * Wraps Phaser's raw pointer/wheel events into camera pan + zoom (drag or
 * single-finger touch to pan, wheel or two-finger pinch to zoom). Kept
 * separate from any one Scene, per the plan's platform-readiness notes, so
 * touch and mouse are handled through the same code path from day one.
 */
export class InputController {
    private readonly scene: Scene;
    private readonly camera: Cameras.Scene2D.Camera;
    private readonly minZoom: number;
    private readonly maxZoom: number;
    private readonly wheelZoomStep: number;

    private isPanning = false;
    // Tracked ourselves (rather than Phaser's Pointer.prevPosition) so that
    // switching from a two-finger pinch back down to a single pointer can't
    // apply a jump from a stale previous position.
    private lastPanX = 0;
    private lastPanY = 0;
    private lastPinchDistance = -1;

    constructor(scene: Scene, config: InputControllerConfig = {}) {
        this.scene = scene;
        this.camera = scene.cameras.main;
        this.minZoom = config.minZoom ?? 0.5;
        this.maxZoom = config.maxZoom ?? 2;
        this.wheelZoomStep = config.wheelZoomStep ?? 0.1;

        // A second simultaneous pointer is needed to recognize pinch-zoom.
        scene.input.addPointer(1);

        scene.input.on('pointerdown', this.onPointerDown, this);
        scene.input.on('pointermove', this.onPointerMove, this);
        scene.input.on('pointerup', this.onPointerUp, this);
        scene.input.on('pointerupoutside', this.onPointerUp, this);
        scene.input.on('wheel', this.onWheel, this);
    }

    destroy(): void {
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.scene.input.off('wheel', this.onWheel, this);
    }

    private get activePointers(): Input.Pointer[] {
        return this.scene.input.manager.pointers.filter((pointer) => pointer.isDown);
    }

    private beginPanningAt(x: number, y: number): void {
        this.isPanning = true;
        this.lastPanX = x;
        this.lastPanY = y;
    }

    private onPointerDown = (pointer: Input.Pointer): void => {
        if (this.activePointers.length === 1) {
            this.beginPanningAt(pointer.x, pointer.y);
        } else {
            this.isPanning = false;
        }
    };

    private onPointerMove = (pointer: Input.Pointer): void => {
        const pointers = this.activePointers;

        if (pointers.length >= 2) {
            this.isPanning = false;
            this.handlePinch(pointers[0], pointers[1]);
            return;
        }

        this.lastPinchDistance = -1;

        if (this.isPanning && pointer.isDown) {
            this.camera.scrollX -= (pointer.x - this.lastPanX) / this.camera.zoom;
            this.camera.scrollY -= (pointer.y - this.lastPanY) / this.camera.zoom;
            this.lastPanX = pointer.x;
            this.lastPanY = pointer.y;
        }
    };

    private onPointerUp = (): void => {
        this.lastPinchDistance = -1;

        const pointers = this.activePointers;
        if (pointers.length === 1) {
            // Re-baseline against the still-down pointer's current position
            // (not wherever it was during the pinch) so panning resumes
            // cleanly with no jump.
            this.beginPanningAt(pointers[0].x, pointers[0].y);
        } else {
            this.isPanning = false;
        }
    };

    private handlePinch(a: Input.Pointer, b: Input.Pointer): void {
        const distance = PhaserMath.Distance.Between(a.x, a.y, b.x, b.y);

        if (this.lastPinchDistance > 0) {
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            this.zoomBy(distance / this.lastPinchDistance, midX, midY);
        }

        this.lastPinchDistance = distance;
    }

    // Reads Pointer.deltaY directly rather than relying on the 'wheel'
    // event's positional callback args, whose order isn't confirmed for
    // Phaser 4 in this codebase.
    private onWheel = (pointer: Input.Pointer): void => {
        const factor = pointer.deltaY > 0 ? 1 - this.wheelZoomStep : 1 + this.wheelZoomStep;
        this.zoomBy(factor, pointer.x, pointer.y);
    };

    // Zooms while keeping the world point under (screenX, screenY) fixed on
    // screen, by measuring that point before/after the zoom change and
    // shifting scroll to cancel out the difference.
    private zoomBy(factor: number, screenX: number, screenY: number): void {
        const worldPointBefore = this.camera.getWorldPoint(screenX, screenY);
        const newZoom = PhaserMath.Clamp(this.camera.zoom * factor, this.minZoom, this.maxZoom);
        this.camera.setZoom(newZoom);

        const worldPointAfter = this.camera.getWorldPoint(screenX, screenY);
        this.camera.scrollX += worldPointBefore.x - worldPointAfter.x;
        this.camera.scrollY += worldPointBefore.y - worldPointAfter.y;
    }
}
