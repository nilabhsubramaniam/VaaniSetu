/**
 * Pointer input for the hero scene: normalized position for camera parallax,
 * and drag delta for rotating the root group. Deliberately does NOT do
 * raycasting/hit-testing — language selection is a real DOM button list
 * (`hero-experience`'s `.language-pill`s), not a 3D pick target, so there is
 * nothing here to hit-test against.
 */
export class InteractionController {
  private pointerX = 0;
  private pointerY = 0;
  private isDragging = false;
  private lastDragX = 0;
  private lastDragY = 0;
  dragDeltaX = 0;
  dragDeltaY = 0;

  constructor(private readonly el: HTMLElement) {
    this.el.addEventListener('pointermove', this.handlePointerMove);
    this.el.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  get parallax(): { readonly x: number; readonly y: number } {
    return { x: this.pointerX, y: this.pointerY };
  }

  consumeDragDelta(): { readonly x: number; readonly y: number } {
    const delta = { x: this.dragDeltaX, y: this.dragDeltaY };
    this.dragDeltaX = 0;
    this.dragDeltaY = 0;
    return delta;
  }

  dispose(): void {
    this.el.removeEventListener('pointermove', this.handlePointerMove);
    this.el.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const rect = this.el.getBoundingClientRect();
    this.pointerX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerY = ((event.clientY - rect.top) / rect.height) * 2 - 1;

    if (this.isDragging) {
      this.dragDeltaX += event.clientX - this.lastDragX;
      this.dragDeltaY += event.clientY - this.lastDragY;
      this.lastDragX = event.clientX;
      this.lastDragY = event.clientY;
    }
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.isDragging = true;
    this.lastDragX = event.clientX;
    this.lastDragY = event.clientY;
  };

  private readonly handlePointerUp = (): void => {
    this.isDragging = false;
  };
}
