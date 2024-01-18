import { DeleteOutlined } from '@ant-design/icons';
import { Button, InputNumber, Select, TableProps } from 'antd';
import { MutableRefObject, useMemo } from 'react';
import BoxerStage, { ClientRect, IBox } from '../../../core/BoxerStage.ts';

export interface IUseTable<LABEL extends string = string>
  extends Required<Pick<TableProps<IBox<LABEL>>, 'columns' | 'scroll' | 'onRow' | 'rowSelection'>> {
}

export default function useTable<LABEL extends string = string>(
  stageRef: MutableRefObject<BoxerStage | null>,
  labels: LABEL[],
  height: number,
): IUseTable<LABEL> {

  const columns: TableProps<IBox<LABEL>>['columns'] = useMemo(() => {
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
  }, [labels, stageRef]);

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

  return {
    columns,
    scroll,
    rowSelection,
    onRow,
  };
}
