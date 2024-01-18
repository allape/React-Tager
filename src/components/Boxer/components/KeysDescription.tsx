import { Table, TableProps } from 'antd';
import { LabeledValue } from 'antd/es/select';
import React from 'react';

const columns: TableProps<LabeledValue>['columns'] = [
  {
    dataIndex: 'value',
    title:     'Keys',
  },
  {
    dataIndex: 'label',
    title:     'Description',
  },
];
const dataSource: LabeledValue[] = [
  {
    label: 'Remove selected box',
    value: '[Delete] / [Backspace]',
  },
  {
    label: 'Switch to next/prev box',
    value: '[Tab] / [Shift+Tab]',
  },
  {
    label: 'Move box 1px',
    value: '[→/←/↑/↓]',
  },
  {
    label: 'Move box 10px',
    value: '[Ctrl/Cmd] + [→/←/↑/↓]',
  },
  {
    label: 'Expand/Shrink 1px',
    value: '[Shift] + [→/←/↑/↓]',
  },
  {
    label: 'Expand/Shrink 10px',
    value: '[Ctrl/Cmd] + [Shift] + [→/←/↑/↓]',
  },
  {
    label: 'Move canvas up or down',
    value: '[MouseWheel]',
  },
  {
    label: 'Move canvas left or right',
    value: '[Shift] + [MouseWheel]',
  },
  {
    label: 'Zoom canvas in or out',
    value: '[Ctrl] + [MouseWheel]',
  },
];

export default function KeysDescription(): React.ReactElement {
  return <Table rowKey="value" columns={columns} dataSource={dataSource} pagination={false}/>;
}