import { DeleteOutlined } from '@ant-design/icons';
import { Button, InputNumber, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import cls from 'classnames';
import { debounce } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import BoxerStage, { ClientRect, IBox } from '../../core/BoxerStage.ts';
import styles from './style.module.scss';

export interface IBoxerProps {
  className?: string;
  width?: number;
  height?: number;
  controls?: boolean;
}

export interface IBoxFormItem extends Pick<IBox, 'x' | 'y' | 'width' | 'height' | '_id'> {

}

export interface IBoxForm {
  boxes: IBoxFormItem[];
}

export default function Boxer({ width = 640, height = 480, controls, className }: IBoxerProps): React.ReactElement {
  const stageRef = useRef<BoxerStage | null>(null);

  const [boxes, setBoxes] = useState<IBox[]>([]);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!container) {
      return undefined;
    }

    const stage = new BoxerStage({
      container, width, height,
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
      case 'Tab':
        e.preventDefault();
        stage.highlightNextBox();
        break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const box = stage.getTopBox();
        if (!box) {
          break;
        }
        stage.highlightNextBox();
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

    const handleWheel = (e: WheelEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      e.preventDefault();
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
  }, [container, height, width]);

  const handleOnFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || !files.length) {
      return;
    }
    const file = files[0];
    stageRef.current?.setBackGroundImage(window.URL.createObjectURL(file));
    e.target.value = '';
  };

  const columns: ColumnsType<IBox> = useMemo(() => {
    const handleChange = (box: IBox, attr: keyof ClientRect, value: number): void => {
      box.setAttr(attr, value);
      box.normalize();
    };
    return [
      {
        title:     'id',
        dataIndex: '_id',
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
  }, []);

  const topBox = stageRef.current?.getTopBox();

  return <div className={styles.wrapper}>
    <div className={styles.canvas}>
      <input type="file" onChange={handleOnFileChange}/>
      <div className={cls(styles.container, className)} tabIndex={0} ref={setContainer}/>
    </div>
    {controls &&
        <Table className={styles.controls} scroll={{ y: height - 53 }} rowSelection={{
          hideSelectAll:   true,
          type:            'radio',
          selectedRowKeys: topBox?._id ? [topBox?._id] : [],
          onChange:        (_, rows) => rows[0]?.move2Top(),
        }} rowKey="_id" columns={columns} dataSource={boxes} pagination={false} onRow={box => ({
          onClick: box.move2Top,
        })}/>
    }
  </div>;
}
