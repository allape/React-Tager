import { Modal } from 'antd';
import React from 'react';
import ScriptFormItem, { IScriptFormItemProps } from '../ScriptFormItem';

export interface ILabelsFormItemProps<LABEL extends string = string> extends IScriptFormItemProps<LABEL[]> {
}

export function HandleParse<T extends string = string>(labelString: string): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    const labels = labelString.split('\n').map(i => i.trim()).filter(Boolean) as T[];
    Modal.confirm({
      title:   'Labels confirmation',
      content: <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {labels.map((label, index) => <div key={index}>{label}</div>)}
      </div>,
      okText:     'Confirm',
      cancelText: 'Back to edit',
      onOk:       () => {
        resolve(labels);
      },
      onCancel: () => {
        reject();
      },
    });
  });
}

export function HandleStringify(labels?: unknown[]): string {
  return labels?.join('\n') || '';
}

export default function LabelsFormItem<LABEL extends string = string>(
  props: ILabelsFormItemProps<LABEL>,
): React.ReactElement {
  return <ScriptFormItem<LABEL[]> title="Edit labels"
    onStringify={HandleStringify}
    onParse={HandleParse<LABEL>} {...props}>Edit Labels</ScriptFormItem>;
}
