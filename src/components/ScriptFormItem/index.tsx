import { Button, ButtonProps, Input, Modal } from 'antd';
import React, { PropsWithChildren } from 'react';

export interface IScriptFormItemProps<T> {
  value?: T;
  onChange?: (value?: T) => void;
  onStringify?: (value?: T) => string;
  onParse?: (value: string) => T | Promise<T>;
  buttonProps?: ButtonProps;
  title?: string;
}

export default function ScriptFormItem<T = unknown>({ 
  value, 
  onChange, 
  children, 
  title, 
  onStringify, 
  onParse, 
  buttonProps,
}: PropsWithChildren<IScriptFormItemProps<T>>): React.ReactElement {
  const handleClick = (): void => {
    let labelString = onStringify?.(value) || `${value}`;
    Modal.info({
      title:    title || 'Edit',
      closable: true,
      content:  <Input.TextArea
        rows={10}
        defaultValue={labelString}
        onChange={e => {
          labelString = e.target.value;
        }}></Input.TextArea>,
      okText: 'Save',
      onOk:   (close) => {
        if (onParse) {
          const parsedValue = onParse(labelString);
          if (parsedValue instanceof Promise) {
            parsedValue.then((value) => {
              onChange?.(value);
              close();
            }).catch(() => {});
            return false;
          }
          onChange?.(parsedValue);
          return;
        }
        onChange?.(labelString as T);
      },
    });
  };
  return <Button onClick={handleClick} {...buttonProps}>{children || 'Edit'}</Button>;
}
