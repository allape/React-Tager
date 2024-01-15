import { Button, Modal, Input } from 'antd';
import React, { useCallback } from 'react';

export interface ILabelsFormItemProps<LABEL extends  string = string> {
  value?: LABEL[];
  onChange?: (value: LABEL[]) => void;
}

export default function LabelsFormItem({ value, onChange }: ILabelsFormItemProps): React.ReactElement {
  const handleClick = useCallback(() => {
    let labelString = value?.join('\n') || '';
    Modal.info({
      title:   'Edit labels',
      content: <Input.TextArea
        rows={10}
        defaultValue={labelString}
        onChange={e => {
          labelString = e.target.value;
        }}></Input.TextArea>,
      okText: 'Save',
      onOk:   (close) => {
        const newLabels = labelString.split('\n').map(i => i.trim()).filter(Boolean);
        Modal.confirm({
          title:   'Labels confirmation',
          content: <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {newLabels.map((label, index) => <div key={index}>{label}</div>)}
          </div>,
          okText:     'Confirm',
          cancelText: 'Back to edit',
          onOk:       () => {
            close();
            onChange?.(labelString.split('\n'));
          },
        });
        return false;
      },
    });
  }, [onChange, value]);
  return <Button onClick={handleClick}>Edit Labels</Button>;
}
