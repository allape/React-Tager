import { DeleteOutlined } from '@ant-design/icons';
import { Button, InputNumber, Select, Table, TableProps } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cls from 'classnames';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BoxerStage, { ClientRect, IBox, ILayerEvent } from '../../core/BoxerStage.ts';
import KeysDescription from './KeysDescription.tsx';
import styles from './style.module.scss';

export type ClientRectWithLabel<LABEL extends string> = ClientRect & { label: LABEL };

export interface IBoxerProps<LABEL extends string> {
  className?: string;
  labels: LABEL[];
  defaultLabel: LABEL;
  width?: number;
  height?: number;
  controls?: boolean;
  imageURL?: string;
  /**
   * Description of keyboard and mouse controls
   */
  keysDescriptionVisible?: boolean;
  /**
   * DND = Drag and Drop
   */
  allowDND?: boolean;
  allowKeyboard?: boolean;
  allowMouseWheel?: boolean;
  onChange?: (boxes: IBox<LABEL>[]) => void;
  onImageNameChange?: (imageName?: string) => void;
  onPredicate?: (imageURL: string) => Promise<ClientRectWithLabel<LABEL>[]>;
}

export const PredicationCache: Record<string, ClientRectWithLabel<string>[]> = {};

export default function Boxer<LABEL extends string = string>({
  labels,
  defaultLabel,
  width = 500,
  height = 500,
  controls,
  className,
  imageURL,
  keysDescriptionVisible,
  allowDND,
  allowKeyboard,
  allowMouseWheel,
  onChange,
  onImageNameChange,
  onPredicate,
}: IBoxerProps<LABEL>): React.ReactElement {
  const wrapperId = useMemo(() => `BoxWrapper_${Date.now()}_${Math.floor(Math.random() * 10000)}`, []);

  const imageURLRef = useRef<string | undefined>(imageURL);
  const stageRef = useRef<BoxerStage<LABEL> | null>(null);

  const [fileOverDropZone, setFileOverDropZone] = useState<boolean>(false);

  const [boxes, _setBoxes] = useState<IBox<LABEL>[]>([]);
  const setBoxes = useCallback((valueOrFunc: IBox<LABEL>[] | ((oldValue: IBox<LABEL>[]) => IBox<LABEL>[])) => {
    _setBoxes(oldValues => {
      const newBoxes = valueOrFunc instanceof Function ? valueOrFunc(oldValues) : valueOrFunc;
      onChange?.(newBoxes);
      return newBoxes;
    });
  }, [onChange]);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  const setBackgroundImage = useCallback((imageURL: string, imageName?: string) => {
    // if (!imageURL || imageURLRef.current === imageURL) {
    //   return;
    // }
    if (imageName) {
      onImageNameChange?.(imageName);
    }  else {
      try {
        const url = new URL(imageURL);
        onImageNameChange?.(url.pathname.split('/').pop());
      } catch (e) {
        console.error('unable to decode', imageURL, ':', e);
      }
    }
    if (imageURLRef.current && imageURLRef.current!.startsWith('blob://')) {
      window.URL.revokeObjectURL(imageURLRef.current!);
    }
    stageRef.current?.setBackgroundImage(imageURL).then();
    imageURLRef.current = imageURL;

    const drawBoxes = (rects: ClientRectWithLabel<LABEL>[]) => {
      rects.forEach(rect => {
        stageRef.current?.drawBox(rect.x, rect.y, rect.width, rect.height, rect.label);
      });
      setBoxes(stageRef.current?.getBoxes() || []);
      stageRef.current?.highlightNext();
    };

    if (PredicationCache[imageURL]) {
      drawBoxes(PredicationCache[imageURL] as ClientRectWithLabel<LABEL>[]);
    } else {
      PredicationCache[imageURL] = [];
      onPredicate?.(imageURL).then(rects => {
        PredicationCache[imageURL] = rects;
        // image has changed
        if (imageURL !== imageURLRef.current) {
          return;
        }
        drawBoxes(rects);
      }).catch(() => {
        delete PredicationCache[imageURL];
      });
    }
  }, [onImageNameChange, onPredicate, setBoxes]);

  useEffect(() => {
    if (!imageURL) {
      return;
    }
    setBackgroundImage(imageURL);
  }, [setBackgroundImage, imageURL]);

  useEffect(() => {
    if (!container) {
      return undefined;
    }

    const stage = new BoxerStage<LABEL>({
      container, width, height, defaultLabel,
    });
    stage.on('change', debounce(() => {
      const newBoxes = [...stage.getBoxes()].sort((a, b) => a._id - b._id);
      setBoxes(newBoxes);
    }, 100, {
      leading:  false,
      trailing: true,
    }));

    stageRef.current = stage;

    if (imageURLRef.current) {
      setBackgroundImage(imageURLRef.current);
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      switch (e.key) {
      case 'Tab': {
        e.preventDefault();
        const nextBox = stage.highlightNext();
        if (nextBox) {
          const row = window.document.querySelector(`#${wrapperId} [data-row-key="` + nextBox._id + '"]');
          row?.scrollIntoView({
            behavior: 'smooth',
            block:    'center',
            inline:   'center',
          });
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const box = stage.getTopBox();
        if (!box) {
          break;
        }
        stage.highlightNext();
        box.dispose();
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        const box = stage.getTopBox();
        if (!box) {
          break;
        }
        e.preventDefault();
        const x = box.x();
        const y = box.y();
        const step = e.ctrlKey || e.metaKey ? 10 : 1;
        const deltaX = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const deltaY = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (e.shiftKey) {
          box.setAttr('width', box.width() + deltaX);
          box.setAttr('height', box.height() + deltaY);
        } else {
          box.setAttr('x', x + deltaX);
          box.setAttr('y', y + deltaY);
        }
        box.normalize();
        break;
      }
      }
    };
    if (allowKeyboard) {
      container.addEventListener('keydown', handleKeyDown);
    }

    const handleWheel = (e: WheelEvent & Partial<ILayerEvent>): void => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        let scale = stage.getZoom();
        scale = scale - e.deltaY / 100;
        stage.zoom(scale, { x: e.layerX || 0, y: e.layerY || 0 });
        return;
      }
      stage.moveDelta({ x: -e.deltaX, y: -e.deltaY });
    };
    if (allowMouseWheel) {
      container.addEventListener('wheel', handleWheel);
    }

    return (): void => {
      stage.dispose();
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('wheel', handleWheel);
      setBoxes([]);
    };
  }, [allowKeyboard, allowMouseWheel, container, defaultLabel, height, setBackgroundImage, setBoxes, width, wrapperId]);

  const columns: ColumnsType<IBox<LABEL>> = useMemo(() => {
    const handleChange = (box: IBox<LABEL>, attr: keyof ClientRect, value: number): void => {
      box.setAttr(attr, value);
      box.normalize();
    };
    const handleLabelChange = (box: IBox<LABEL>, label: LABEL) => {
      box.label = label;
      stageRef.current?.setDefaultLabel(label);
    };
    return [
      {
        title:     'id',
        dataIndex: '_id',
      },
      {
        title:     'label',
        dataIndex: 'label',
        render:    (_, box) => {
          return <Select<LABEL> options={labels.map(label => ({ label, value: label }))} value={box.label as LABEL}
            allowClear showSearch
            onChange={value => handleLabelChange(box, value)}/>;
        },
      },
      {
        title:     'x',
        dataIndex: 'x',
        render:    (_, box) => {
          return <InputNumber min={0} step={1} precision={0} value={box.x()}
            onChange={value => handleChange(box, 'x', value || 0)}/>;
        },
      },
      {
        title:     'y',
        dataIndex: 'y',
        render:    (_, box) => {
          return <InputNumber min={0} step={1} precision={0} value={box.y()}
            onChange={value => handleChange(box, 'y', value || 0)}/>;
        },
      },
      {
        title:     'w',
        dataIndex: 'width',
        render:    (_, box) => {
          return <InputNumber min={3} step={1} precision={0} value={box.width()}
            onChange={value => handleChange(box, 'width', value || 0)}/>;
        },
      },
      {
        title:     'h',
        dataIndex: 'height',
        render:    (_, box) => {
          return <InputNumber min={3} step={1} precision={0} value={box.height()}
            onChange={value => handleChange(box, 'height', value || 0)}/>;
        },
      },
      {
        title:     'ops',
        dataIndex: '_id',
        render:    (_, box) => {
          return <>
            <Button type="link" onClick={(e) => {
              e.stopPropagation();
              box.dispose();
            }} danger><DeleteOutlined/></Button>
          </>;
        },
      },
    ];
  }, [labels]);

  // DND
  useEffect(() => {
    if (!allowDND || !container) {
      return undefined;
    }

    const handleDropEnter = (e: DragEvent) => {
      e.preventDefault();
      setFileOverDropZone(true);
    };
    const handleDropLeave = (e: DragEvent) => {
      e.preventDefault();
      setFileOverDropZone(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setFileOverDropZone(false);

      const file = e.dataTransfer?.files?.[0];
      if (!file) {
        return;
      }
      setBackgroundImage(window.URL.createObjectURL(file), file.name);
    };

    container.addEventListener('dragenter', handleDropEnter, true);
    container.addEventListener('dragover', handleDropEnter, true);
    container.addEventListener('dragleave', handleDropLeave, true);
    container.addEventListener('drop', handleDrop, true);
    return () => {
      container.removeEventListener('dragenter', handleDropEnter, true);
      container.removeEventListener('dragover', handleDropEnter, true);
      container.removeEventListener('dragleave', handleDropLeave, true);
      container.removeEventListener('drop', handleDrop, true);
    };
  }, [allowDND, container, setBackgroundImage]);

  const scroll: TableProps<IBox<LABEL>>['scroll'] = useMemo(() => ({ y: height - 53 }), [height]);

  const onRow: TableProps<IBox<LABEL>>['onRow'] = useMemo(() => box => ({
    onClick: () => box.highlight(),
  }), []);

  const topBox = stageRef.current?.getTopBox();

  const rowSelection: TableProps<IBox<LABEL>>['rowSelection'] = {
    hideSelectAll:   true,
    type:            'radio',
    selectedRowKeys: topBox?._id ? [topBox?._id] : [],
    onChange:        (_, rows) => rows[0]?.highlight(),
  };

  return <div id={wrapperId} className={styles.wrapper}>
    <div className={cls(styles.canvas, fileOverDropZone && styles.dnd)}>
      <div className={cls(styles.container, className)} tabIndex={0} ref={setContainer}/>
    </div>
    {keysDescriptionVisible && <KeysDescription />}
    {controls &&
        <Table<IBox<LABEL>> className={styles.controls} rowKey="_id" columns={columns} dataSource={boxes}
          scroll={scroll} rowSelection={rowSelection}
          pagination={false} onRow={onRow}/>
    }
  </div>;
}
