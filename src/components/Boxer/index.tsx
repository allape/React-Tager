import { DeleteOutlined } from '@ant-design/icons';
import { Button, InputNumber, Select, Table, TableProps } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cls from 'classnames';
import { debounce } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BoxerStage, { ClientRect, IBox, ILayerEvent } from '../../core/BoxerStage.ts';
import styles from './style.module.scss';

export interface IBoxerProps<LABEL> {
  className?: string;
  labels: LABEL[];
  width?: number;
  height?: number;
  controls?: boolean;
}

export const DEFAULT_LABEL = 'unknown';

export default function Boxer<LABEL extends string = string>({
  labels,
  width = 640,
  height = 480,
  controls,
  className,
}: IBoxerProps<LABEL>): React.ReactElement {
  const wrapperId = useMemo(() => `BoxWrapper_${Date.now()}_${Math.floor(Math.random() * 10000)}`, []);
  const stageRef = useRef<BoxerStage<LABEL> | null>(null);

  const [fileOverDropZone, setFileOverDropZone] = useState<boolean>(false);

  const [boxes, setBoxes] = useState<IBox<LABEL>[]>([]);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) {
      return undefined;
    }

    const stage = new BoxerStage<LABEL>({
      container, width, height, defaultLabel: DEFAULT_LABEL as LABEL,
    });
    stage.on('change', debounce(() => {
      setBoxes([...stage.getBoxes()].sort((a, b) => a._id - b._id));
    }, 100, {
      leading:  false,
      trailing: true,
    }));

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    window.__boxStage = stage;
    stage.setBackGroundImage('http://127.0.0.1:3001/R-C.gif').then();

    stageRef.current = stage;

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
    container.addEventListener('keydown', handleKeyDown);

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
    container.addEventListener('wheel', handleWheel);

    return (): void => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      delete window.__boxStage;
      stage.dispose();
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('wheel', handleWheel);
    };
  }, [container, height, width, wrapperId]);

  const handleOnFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || !files.length) {
      return;
    }
    const file = files[0];
    stageRef.current?.setBackGroundImage(window.URL.createObjectURL(file));
    e.target.value = '';
  };

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
      stageRef.current?.setBackGroundImage(window.URL.createObjectURL(file));
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
  }, []);

  const topBox = stageRef.current?.getTopBox();

  const rowSelection: TableProps<IBox<LABEL>>['rowSelection'] = {
    hideSelectAll:   true,
    type:            'radio',
    selectedRowKeys: topBox?._id ? [topBox?._id] : [],
    onChange:        (_, rows) => rows[0]?.highlight(),
  };

  const scroll: TableProps<IBox<LABEL>>['scroll'] = useMemo(() => ({ y: height - 53 }), [height]);

  const onRow: TableProps<IBox<LABEL>>['onRow'] = useMemo(() => box => ({
    onClick: () => box.highlight(),
  }), []);

  return <div id={wrapperId} className={styles.wrapper}>
    <div className={cls(styles.canvas, fileOverDropZone && styles.dnd)}>
      <input type="file" onChange={handleOnFileChange}/>
      <div className={cls(styles.container, className)} tabIndex={0} ref={setContainer}/>
    </div>
    {controls &&
        <Table<IBox<LABEL>> className={styles.controls} rowKey="_id" columns={columns} dataSource={boxes}
          scroll={scroll} rowSelection={rowSelection}
          pagination={false} onRow={onRow}/>
    }
  </div>;
}
