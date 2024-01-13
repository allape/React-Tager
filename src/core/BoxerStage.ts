import EventEmitter2, { ConstructorOptions, event, eventNS, Listener, ListenerFn, OnOptions } from 'eventemitter2';
import Konva from 'konva';
import { debounce } from 'lodash';

export type Node = Konva.Node;
export type ClientRect = ReturnType<Node['getClientRect']>;
export type TransformerAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export type Pixel = number;
export type X = Pixel;
export type Y = Pixel;

export interface INormalizedBox {
  x: X;
  y: Y;
  width: Pixel;
  height: Pixel;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface ILayerMouseEvent extends MouseEvent {
  layerX: X;
  layerY: Y;
}

export interface IBox extends Konva.Rect {
  transformer: Konva.Transformer;
  dispose: () => void;
  normalize: () => void;
  move2Top: () => void;
}

export interface IBoxerStageOptions {
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
   * @default DEFAULT_BOX_WIDTH
   * @see BoxerStage#DEFAULT_BOX_WIDTH
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
}

export class BoxerStageEventEmitter extends EventEmitter2 {
  on(event: 'change', listener: (boxes: IBox[]) => void): this | Listener;
  on(event: event | eventNS, listener: ListenerFn, options?: boolean | OnOptions): this | Listener {
    return super.on(event, listener, options);
  }

  off(event: 'change', listener: (boxes: IBox[]) => void): this;
  off(event: event | eventNS, listener: ListenerFn): this {
    return super.off(event, listener);
  }

  emit(event: 'change', boxes: IBox[]): boolean;
  emit(event: event | eventNS, ...values: unknown[]): boolean {
    return super.emit(event, ...values);
  }
}

export default class BoxerStage extends BoxerStageEventEmitter {
  protected static readonly DEFAULT_BOX_WIDTH: Pixel = 2;

  protected static readonly DIMINISHED_COLOR = 'rgba(0, 0, 0, 0.3)';
  protected static readonly DIMINISHED_ANCHORS: TransformerAnchor[] = [];
  protected static readonly HIGHLIGHT_COLOR = 'red';
  protected static readonly HIGHLIGHT_ANCHORS: TransformerAnchor[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

  protected readonly options: Required<IBoxerStageOptions>;
  protected readonly stage: Konva.Stage;
  protected readonly backgroundLayer: Konva.Layer;
  protected readonly boxesLayer: Konva.Layer;

  protected isMouseDownInBoxRect: boolean = false;
  protected currentBox: IBox | null = null;

  constructor(options: IBoxerStageOptions) {
    super(options.eventEmitterOptions);
    this.stage = new Konva.Stage({
      container: options.container,
      width:     options.width,
      height:    options.height,
    });

    this.options = {
      ...options,
      minimumSize:         options.minimumSize || 3,
      boxWidth:            options.boxWidth && options.boxWidth > 0 ? options.boxWidth : BoxerStage.DEFAULT_BOX_WIDTH,
      eventEmitterOptions: options.eventEmitterOptions || {},
    };

    this.backgroundLayer = new Konva.Layer({
      x: 0, y: 0,
    });
    this.boxesLayer = new Konva.Layer({
      x: 0, y: 0,
    });

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.boxesLayer);

    // this.backgroundLayer.add(new Konva.Rect({
    //   x: 0,
    //   y: 0,
    //   width: options.width / 2,
    //   height: options.height / 2,
    //   draggable: false,
    //   stroke: 'blue',
    //   strokeWidth: 2
    // }))

    this.stage.on('mousedown', this.handleStageMouseDown);
    this.stage.on('mousemove', this.handleStageMouseMove);
    this.stage.on('mouseup', this.handleStageMouseUp);
  }

  public dispose = (): void => {
    this.removeAllListeners();
    this.stage.destroy();
  };

  protected readonly handleStageMouseDown = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (this.isMouseDownInBoxRect || !this.getBackgroundImage()) {
      return;
    }
    const e = BoxerStage.SafeLayerEvent(_e);
    const box = this.createNewBox(e.evt.layerX - this.boxesLayer.x(), e.evt.layerY - this.boxesLayer.y());
    this.currentBox = box;
    this.highlight(box);
  };

  protected readonly handleStageMouseMove = (_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!this.currentBox) {
      return;
    }
    const e = BoxerStage.SafeLayerEvent(_e);
    this.currentBox.setAttrs({
      width:  e.evt.layerX - this.currentBox.x() - this.boxesLayer.x(),
      height: e.evt.layerY - this.currentBox.y() - this.boxesLayer.y(),
    });
  };

  protected readonly handleStageMouseUp = (e: Konva.KonvaEventObject<MouseEvent>): void => {
    this.handleStageMouseMove(e);
    if (!this.currentBox) {
      return;
    }
    if (Math.abs(this.currentBox.width()) < this.options.minimumSize || Math.abs(this.currentBox.height()) < this.options.minimumSize) {
      this.currentBox.dispose();
      this.currentBox = null;
      return;
    }
    this.normalizeBox(this.currentBox);
    this.currentBox = null;
  };

  protected readonly handleMouseDownInBoxRect = (): void => {
    this.isMouseDownInBoxRect = true;
  };

  protected readonly handleMouseUpInBoxRect = (): void => {
    this.isMouseDownInBoxRect = false;
  };

  public readonly diminishAll = (): void => {
    this.getBoxes().forEach(box => {
      const tr = box.transformer;
      tr.borderStroke(BoxerStage.DIMINISHED_COLOR);
      tr.enabledAnchors(BoxerStage.DIMINISHED_ANCHORS);
    });
  };

  public readonly highlight = (box: IBox): void => {
    this.diminishAll();
    box.moveToTop();
    const tr = box.transformer;
    tr.moveToTop();
    tr.borderStroke(BoxerStage.HIGHLIGHT_COLOR);
    tr.enabledAnchors(BoxerStage.HIGHLIGHT_ANCHORS);
    this.emit('change', this.getBoxes());
  };

  public readonly normalize = ({ x, y, width, height }: ClientRect): INormalizedBox => {
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
  };

  public readonly normalizeBox = (box: IBox): void => {
    const attrs = this.normalize(box.getClientRect({ relativeTo: this.boxesLayer }));
    box.setAttrs(attrs);
    this.emit('change', this.getBoxes());
  };

  protected readonly createNewBox = (x: number, y: number): IBox => {
    const box: IBox = new Konva.Rect({
      x:         x,
      y:         y,
      width:     0,
      height:    0,
      draggable: true,
    }) as IBox;
    box.on('click', () => this.highlight(box));
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
      this.normalizeBox(box);
    }, 100, { leading: false, trailing: true });

    tr.on('mousedown', this.handleMouseDownInBoxRect);
    tr.on('mouseup', this.handleMouseUpInBoxRect);
    tr.on('transform', debouncedNormalizeBox);
    tr.on('dragend', () => this.normalizeBox(box));
    tr.on('dragstart', () => this.highlight(box));
    this.boxesLayer.add(tr);
    box.transformer = tr;
    box.dispose = (): void => {
      tr.destroy();
      box.destroy();
      this.emit('change', this.getBoxes());
    };
    box.normalize = () => this.normalizeBox(box);
    box.move2Top = () => this.highlight(box);

    return box;
  };

  public readonly getStage = (): Konva.Stage => this.stage;

  public readonly getBoxLayer = (): Konva.Layer => this.boxesLayer;

  public readonly getBackgroundLayer = (): Konva.Layer => this.backgroundLayer;

  public readonly getBoxes = (): IBox[] => (this.boxesLayer.getChildren(node => node instanceof Konva.Rect) as IBox[]);

  public readonly getTopBox = (): IBox | null => {
    const boxes = this.getBoxes().sort((a, b) => b.getZIndex() - a.getZIndex());
    return boxes[0] || null;
  };

  public readonly highlightNextBox = (): IBox | null => {
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
    this.highlight(boxes[indexOfNextTopBox]);
    return boxes[indexOfNextTopBox];
  };

  public async setBackGroundImage(imageURL: string): Promise<void> {
    this.getBoxes().forEach(box => box.dispose());
    return new Promise<void>((resolve, reject) => {
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
        this.backgroundLayer.draw();
        resolve();
      };
      image.onerror = reject;
      image.src = imageURL;
    });
  }

  public getBackgroundImage(): Konva.Image | null {
    return this.backgroundLayer.findOne('Image') as Konva.Image | null;
  }

  public moveDelta = (delta: Konva.Vector2d): void => {
    const background = this.getBackgroundImage();
    if (!background) {
      return;
    }
    let newX = this.backgroundLayer.x() + delta.x;
    let newY = this.backgroundLayer.y() + delta.y;
    if (newX < 0) {
      if (background.width() < this.stage.width()) {
        const minX = -background.width() / 2;
        if (newX < minX) {
          newX = minX;
        }
      } else {
        const minX = -background.width() + this.stage.width() / 2;
        if (newX < minX) {
          newX = minX;
        }
      }
    } else {
      if (background.width() < this.stage.width()) {
        const maxX = this.stage.width() - background.width() / 2;
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
      if (background.height() < this.stage.height()) {
        const minY = -background.height() / 2;
        if (newY < minY) {
          newY = minY;
        }
      } else {
        const minY = -background.height() + this.stage.height() / 2;
        if (newY < minY) {
          newY = minY;
        }
      }
    } else {
      if (background.height() < this.stage.height()) {
        const maxY = this.stage.height() - background.height() / 2;
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
  };

  public move = ({ x, y }: Konva.Vector2d): void => {
    this.backgroundLayer.x(x);
    this.boxesLayer.x(x);
    this.backgroundLayer.y(y);
    this.boxesLayer.y(y);
    this.stage.draw();
  };

  protected static SafeLayerEvent(e: Konva.KonvaEventObject<MouseEvent>): Konva.KonvaEventObject<ILayerMouseEvent> {
    return e as unknown as Konva.KonvaEventObject<ILayerMouseEvent>;
  }
}
