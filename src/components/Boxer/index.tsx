import { DeleteOutlined } from '@ant-design/icons';
import { Button, InputNumber, Select, Table, TableProps } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cls from 'classnames';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BoxerStage, { ClientRect, IBox, ILayerEvent } from '../../core/BoxerStage.ts';
import KeysDescription from './KeysDescription.tsx';
import styles from './style.module.scss';

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
   * Show file select or not
   */
  fileInputVisible?: boolean;
  /**
   * DND = Drag and Drop
   */
  allowDND?: boolean;
  allowKeyboard?: boolean;
  allowMouseWheel?: boolean;
  onChange?: (boxes: IBox<LABEL>[]) => void;
  onImageNameChange?: (imageName?: string) => void;
}

export default function Boxer<LABEL extends string = string>({
  labels,
  defaultLabel,
  width = 500,
  height = 500,
  controls,
  className,
  imageURL,
  keysDescriptionVisible,
  fileInputVisible,
  allowDND,
  allowKeyboard,
  allowMouseWheel,
  onChange,
  onImageNameChange,
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
  }, [onImageNameChange]);

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

  const handleOnFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || !files.length) {
      return;
    }
    const file = files[0];
    setBackgroundImage(window.URL.createObjectURL(file));
    onImageNameChange?.(file.name);
    e.target.value = '';
  }, [onImageNameChange, setBackgroundImage]);

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
    if (!allowDND) {
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

    window.addEventListener('dragenter', handleDropEnter, true);
    window.addEventListener('dragover', handleDropEnter, true);
    window.addEventListener('dragleave', handleDropLeave, true);
    window.addEventListener('drop', handleDrop, true);
    return () => {
      window.removeEventListener('dragenter', handleDropEnter, true);
      window.removeEventListener('dragover', handleDropEnter, true);
      window.removeEventListener('dragleave', handleDropLeave, true);
      window.removeEventListener('drop', handleDrop, true);
    };
  }, [allowDND, setBackgroundImage]);

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
      {fileInputVisible && <input type="file" onChange={handleOnFileChange}/>}
    </div>
    {keysDescriptionVisible && <KeysDescription />}
    {controls &&
        <Table<IBox<LABEL>> className={styles.controls} rowKey="_id" columns={columns} dataSource={boxes}
          scroll={scroll} rowSelection={rowSelection}
          pagination={false} onRow={onRow}/>
    }
  </div>;
}
