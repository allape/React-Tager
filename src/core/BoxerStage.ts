import EventEmitter2, { ConstructorOptions, event, eventNS, Listener, ListenerFn, OnOptions } from 'eventemitter2';
import Konva from 'konva';
import { debounce } from 'lodash';

export type Node = Konva.Node;
export type ClientRect = ReturnType<Node['getClientRect']>;
export type TransformerAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type Pixel = number;
export type X = Pixel;
export type Y = Pixel;

export interface ILayerEvent {
  layerX: X;
  layerY: Y;
}

export interface INormalizedBox {
  x: X;
  y: Y;
  width: Pixel;
  height: Pixel;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface ILayerMouseEvent extends MouseEvent, ILayerEvent {
}

export interface IBox<LABEL extends string = string> extends Konva.Rect {
  label: LABEL;
  transformer: Konva.Transformer;

  dispose(): void;

  normalize(): void;

  highlight(): void;
}

export interface IBoxerStageOptions<LABEL extends string> {
  /**
   * @see StageConfig#container
   */
  container: HTMLDivElement;
  /**
   * @see StageConfig#width
   */
  width: Pixel;
  /**
   * @see StageConfig#height
   */
  height: Pixel;
  /**
   * @see 2
   */
  boxWidth?: Pixel;
  /**
   * box whose size below this value will be deleted
   * @default 3
   */
  minimumSize?: Pixel;
  /**
   * @see ConstructorOptions
   */
  eventEmitterOptions?: ConstructorOptions;
  /**
   * @default ''
   */
  defaultLabel?: LABEL;
}

export abstract class BoxerEventEmitter<LABEL extends string> extends EventEmitter2 {
  on(event: 'change', listener: (boxes: IBox<LABEL>[]) => void): this | Listener;
  on(event: event | eventNS, listener: ListenerFn, options?: boolean | OnOptions): this | Listener {
    return super.on(event, listener, options);
  }

  off(event: 'change', listener: (boxes: IBox<LABEL>[]) => void): this;
  off(event: event | eventNS, listener: ListenerFn): this {
    return super.off(event, listener);
  }

  emit(event: 'change', boxes: IBox<LABEL>[]): boolean;
  emit(event: event | eventNS, ...values: unknown[]): boolean {
    return super.emit(event, ...values);
  }
}

export abstract class BoxerStageCore<LABEL extends string> extends BoxerEventEmitter<LABEL> {
  protected static readonly DIMINISHED_COLOR = 'rgba(0, 0, 0, 0.3)';
  protected static readonly DIMINISHED_ANCHORS: TransformerAnchor[] = [];
  protected static readonly HIGHLIGHT_COLOR = 'red';
  protected static readonly HIGHLIGHT_ANCHORS: TransformerAnchor[] =
    ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  protected readonly options: Required<IBoxerStageOptions<LABEL>>;

  protected readonly stage: Konva.Stage;
  protected readonly backgroundLayer: Konva.Layer;
  protected readonly boxesLayer: Konva.Layer;

  protected constructor(options: IBoxerStageOptions<LABEL>) {
    super(options.eventEmitterOptions);
    this.stage = new Konva.Stage({
      container: options.container,
      width:     options.width,
      height:    options.height,
    });

    this.options = {
      ...options,
      minimumSize:         options.minimumSize || 3,
      boxWidth:            options.boxWidth && options.boxWidth > 0 ? options.boxWidth : 2,
      eventEmitterOptions: options.eventEmitterOptions || {},
      defaultLabel:        options.defaultLabel || '' as LABEL,
    };

    this.backgroundLayer = new Konva.Layer({
      x: 0, y: 0,
    });
    this.boxesLayer = new Konva.Layer({
      x: 0, y: 0,
    });

    // this.backgroundLayer.add(new Konva.Rect({
    //   x: 0,
    //   y: 0,
    //   width: options.width / 2,
    //   height: options.height / 2,
    //   draggable: false,
    //   stroke: 'blue',
    //   strokeWidth: 2
    // }))

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.boxesLayer);
  }

  public dispose(): void {
    this.removeAllListeners();
    this.stage.destroy();
  }

  public normalize({ x, y, width, height }: ClientRect): INormalizedBox {
    const { minimumSize } = this.options;
    const backgroundImage = this.getBackgroundImage();
    const maxWidth = backgroundImage?.width() || this.options.width;
    const maxHeight = backgroundImage?.height() || this.options.height;

    const guardMinimumSize = (): void => {
      if (width < minimumSize) {
        width = minimumSize;
      }
      if (height < minimumSize) {
        height = minimumSize;
      }
    };

    guardMinimumSize();

    if (x >= maxWidth) {
      x = maxWidth - width;
    }
    if (y >= maxHeight) {
      y = maxHeight - height;
    }

    if (x < 0) {
      if (x + width > 0) {
        width = width + x;
        guardMinimumSize();
      }
      x = 0;
    }
    if (y < 0) {
      if (y + height > 0) {
        height = height + y;
        guardMinimumSize();
      }
      y = 0;
    }

    const autoCropOrMoveAtRightBottomCorner = (): void => {
      if (x + width > maxWidth) {
        if (x >= maxWidth) {
          if (width > maxWidth) {
            width = maxWidth;
            x = 0;
          } else {
            x = maxWidth - width;
          }
        } else {
          width = maxWidth - x;
          autoCropOrMoveAtRightBottomCorner();
        }
      }
      if (y + height > maxHeight) {
        if (y >= maxHeight) {
          if (height > maxHeight) {
            height = maxHeight;
            y = 0;
          } else {
            y = maxHeight - height;
          }
        } else {
          height = maxHeight - y;
          autoCropOrMoveAtRightBottomCorner();
        }
      }
    };
    autoCropOrMoveAtRightBottomCorner();

    return {
      x:        x,
      y:        y,
      width:    width,
      height:   height,
      scaleX:   1,
      scaleY:   1,
      rotation: 0,
    };
  }

  public setDefaultLabel(label: LABEL) {
    this.options.defaultLabel = label;
  }

  public getStage(): Konva.Stage {
    return this.stage;
  }

  public getBoxLayer(): Konva.Layer {
    return this.boxesLayer;
  }

  public getBackgroundLayer(): Konva.Layer {
    return this.backgroundLayer;
  }

  public async setBackGroundImage(imageURL: string): Promise<Konva.Image> {
    this.zoom(1);
    return new Promise<Konva.Image>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        let background = this.getBackgroundImage();
        this.move({ x: 0, y: 0 });
        if (background) {
          background.width(image.naturalWidth);
          background.height(image.naturalHeight);
          background.image(image);
        } else {
          background = new Konva.Image({
            x:      0,
            y:      0,
            image:  image,
            width:  image.naturalWidth,
            height: image.naturalHeight,
          });
          this.backgroundLayer.add(background);
        }
        resolve(background);
      };
      image.onerror = reject;
      image.src = imageURL;
    });
  }

  public getBackgroundImage(): Konva.Image | null {
    return this.backgroundLayer.findOne('Image') as Konva.Image | null;
  }

  public moveDelta(delta: Konva.Vector2d): void {
    const background = this.getBackgroundImage();
    if (!background) {
      return;
    }
    const imageWidth = background.width() * this.getZoom();
    const imageHeight = background.height() * this.getZoom();

    let newX = this.backgroundLayer.x() + delta.x;
    let newY = this.backgroundLayer.y() + delta.y;

    if (newX < 0) {
      if (imageWidth < this.stage.width()) {
        const minX = -imageWidth / 2;
        if (newX < minX) {
          newX = minX;
        }
      } else {
        const minX = -imageWidth + this.stage.width() / 2;
        if (newX < minX) {
          newX = minX;
        }
      }
    } else {
      if (imageWidth < this.stage.width()) {
        const maxX = this.stage.width() - imageWidth / 2;
        if (newX > maxX) {
          newX = maxX;
        }
      } else {
        const maxX = this.stage.width() / 2;
        if (newX > maxX) {
          newX = maxX;
        }
      }
    }

    if (newY < 0) {
      if (imageHeight < this.stage.height()) {
        const minY = -imageHeight / 2;
        if (newY < minY) {
          newY = minY;
        }
      } else {
        const minY = -imageHeight + this.stage.height() / 2;
        if (newY < minY) {
          newY = minY;
        }
      }
    } else {
      if (imageHeight < this.stage.height()) {
        const maxY = this.stage.height() - imageHeight / 2;
        if (newY > maxY) {
          newY = maxY;
        }
      } else {
        const maxY = this.stage.height() / 2;
        if (newY > maxY) {
          newY = maxY;
        }
      }
    }

    this.move({ x: newX, y: newY });
  }

  public move({ x, y }: Konva.Vector2d): void {
    this.backgroundLayer.x(x);
    this.boxesLayer.x(x);
    this.backgroundLayer.y(y);
    this.boxesLayer.y(y);
  }

  public zoom(percent: number, at?: Konva.Vector2d): void {
    percent = percent < 0.5 ? 0.5 : (percent > 3 ? 3 : percent);
    this.backgroundLayer.scale({ x: percent, y: percent });
    this.boxesLayer.scale({ x: percent, y: percent });
    if (at) {
      const offset: Konva.Vector2d = { x: this.backgroundLayer.x() - at.x, y: this.backgroundLayer.y() - at.y };
      console.log(offset);
      // this.moveDelta({
      //   x: offset.x * percent,
      //   y: offset.y * percent,
      // })
    }
  }

  public getZoom(): number {
    return Math.abs(this.backgroundLayer.scaleX());
  }

  protected static SafeLayerEvent(e: Konva.KonvaEventObject<MouseEvent>): Konva.KonvaEventObject<ILayerMouseEvent> {
    return e as unknown as Konva.KonvaEventObject<ILayerMouseEvent>;
  }
}

export default class BoxerStage<LABEL extends string = string> extends BoxerStageCore<LABEL> {
  protected isMouseDownInBoxRect: boolean = false;
  protected currentBox: IBox<LABEL> | null = null;

  constructor(options: IBoxerStageOptions<LABEL>) {
    super(options);
    this.stage.on('mousedown', this.handleStageMouseDown);
    this.stage.on('mousemove', this.handleStageMouseMove);
    this.stage.on('mouseup', this.handleStageMouseUp);
  }

  protected readonly handleStageMouseDown = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (this.isMouseDownInBoxRect || !this.getBackgroundImage()) {
      return;
    }
    const e = BoxerStageCore.SafeLayerEvent(_e);
    const box = this.drawBox(
      (e.evt.layerX - this.boxesLayer.x()) / this.getZoom(),
      (e.evt.layerY - this.boxesLayer.y()) / this.getZoom(),
    );
    this.currentBox = box;
    box.highlight();
  };

  protected readonly handleStageMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!this.currentBox) {
      return;
    }
    const e = BoxerStageCore.SafeLayerEvent(_e);
    this.currentBox.setAttrs({
      width:  (e.evt.layerX - this.currentBox.x() * this.getZoom() - this.boxesLayer.x()) / this.getZoom(),
      height: (e.evt.layerY - this.currentBox.y() * this.getZoom() - this.boxesLayer.y()) / this.getZoom(),
    });
  };

  protected readonly handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    this.handleStageMouseMove(e);
    if (!this.currentBox) {
      return;
    }
    if (
      Math.abs(this.currentBox.width()) < this.options.minimumSize
      ||
      Math.abs(this.currentBox.height()) < this.options.minimumSize
    ) {
      this.currentBox.dispose();
      this.currentBox = null;
      return;
    }
    this.currentBox.normalize();
    this.currentBox = null;
  };

  protected readonly handleMouseDownInBoxRect = (): void => {
    this.isMouseDownInBoxRect = true;
  };

  protected readonly handleMouseUpInBoxRect = (): void => {
    this.isMouseDownInBoxRect = false;
  };

  public diminish(): void {
    this.getBoxes().forEach(box => {
      const tr = box.transformer;
      tr.borderStroke(BoxerStage.DIMINISHED_COLOR);
      tr.enabledAnchors(BoxerStage.DIMINISHED_ANCHORS);
    });
  }

  protected drawBox(x: number, y: number): IBox<LABEL> {
    const box: IBox<LABEL> = new Konva.Rect({
      x:         x,
      y:         y,
      width:     0,
      height:    0,
      draggable: true,
    }) as IBox<LABEL>;
    box.on('click', () => box.highlight());
    box.on('mousedown', this.handleMouseDownInBoxRect);
    box.on('mouseup', this.handleMouseUpInBoxRect);
    this.boxesLayer.add(box);

    const tr = new Konva.Transformer({
      nodes:             [box],
      keepRatio:         false,
      rotateEnabled:     false,
      borderStroke:      BoxerStage.HIGHLIGHT_COLOR,
      borderStrokeWidth: this.options.boxWidth,
      enabledAnchors:    BoxerStage.HIGHLIGHT_ANCHORS,
    });

    const debouncedNormalizeBox = debounce(() => {
      box.normalize();
    }, 100, { leading: false, trailing: true });

    tr.on('mousedown', this.handleMouseDownInBoxRect);
    tr.on('mouseup', this.handleMouseUpInBoxRect);
    tr.on('transform', debouncedNormalizeBox);
    tr.on('dragend', () => box.normalize());
    tr.on('dragstart', () => box.highlight());
    this.boxesLayer.add(tr);

    box.label = this.options.defaultLabel;
    box.transformer = tr;
    box.dispose = (): void => {
      tr.destroy();
      box.destroy();
      this.emit('change', this.getBoxes());
    };
    box.normalize = () => {
      const attrs = this.normalize(box.getClientRect({ relativeTo: this.boxesLayer }));
      box.setAttrs(attrs);
      this.emit('change', this.getBoxes());
    };
    box.highlight = () => {
      this.diminish();
      box.moveToTop();
      const tr = box.transformer;
      tr.moveToTop();
      tr.borderStroke(BoxerStage.HIGHLIGHT_COLOR);
      tr.enabledAnchors(BoxerStage.HIGHLIGHT_ANCHORS);
      this.emit('change', this.getBoxes());
    };

    return box;
  }

  public getBoxes(): IBox<LABEL>[] {
    return this.boxesLayer.getChildren(node => node instanceof Konva.Rect) as IBox<LABEL>[];
  }

  public getTopBox(): IBox<LABEL> | null {
    const boxes = this.getBoxes().sort((a, b) => b.getZIndex() - a.getZIndex());
    return boxes[0] || null;
  }

  public highlightNext(): IBox<LABEL> | null {
    const boxes = this.getBoxes();
    if (boxes.length === 0) {
      return null;
    }
    let indexOfNextTopBox = 0;
    const topBox = this.getTopBox();
    if (topBox) {
      indexOfNextTopBox = boxes.indexOf(topBox) + 1;
      if (indexOfNextTopBox >= boxes.length) {
        indexOfNextTopBox = 0;
      }
    }
    boxes[indexOfNextTopBox]?.highlight();
    return boxes[indexOfNextTopBox] || null;
  }

  public async setBackGroundImage(imageURL: string): Promise<Konva.Image> {
    this.getBoxes().forEach(box => box.dispose());
    return super.setBackGroundImage(imageURL);
  }
}
