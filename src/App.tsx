import { Button, Divider, Form, InputNumber, message, Radio, Select, Switch } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './App.module.scss';
import Boxer, { IBoxerProps } from './components/Boxer';
import LabelsFormItem from './components/LabelsFormItem';
import { IBox } from './core/BoxerStage.ts';
import { OutputType, OutputTypeMap, OutputTypes } from './output';

const LABELS: string[] = [
  'person',
  'bicycle',
  'car',
  'motorbike',
  'aeroplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'sofa',
  'pottedplant',
  'bed',
  'diningtable',
  'toilet',
  'tvmonitor',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
];

export type LabelType = typeof LABELS[number];

export interface IProps extends IBoxerProps<LabelType> {
  _labelOptions?: ILabeledValue[];
  _outputType?: OutputType;
}

export const DefaultBoxProps: IProps = {
  labels:                 LABELS,
  defaultLabel:           LABELS[0],
  width:                  500,
  height:                 500,
  controls:               true,
  imageURL:               'http://127.0.0.1:3001/demo.webp',
  fileInputVisible:       true,
  allowDND:               true,
  allowKeyboard:          true,
  allowMouseWheel:        true,
  keysDescriptionVisible: true,
  _outputType:            'YOLO_TXT',
};

export function normalizeProps(props: IProps): IProps {
  const shadowCopiedProps = { ...props };
  shadowCopiedProps._labelOptions = shadowCopiedProps.labels.map((label) => ({ label, value: label }));
  return shadowCopiedProps;
}

export const CACHE_KEY = `CACHED_BOXER_PROPS_${BOXER_VERSION}`;

export default function App(): React.ReactElement {
  const boxesRef = useRef<IBox<LabelType>[]>([]);
  const imageFileNameRef = useRef<string>('');
  const [props, setProps] = useState<IProps | undefined>(undefined);

  const [form] = Form.useForm<IProps>();

  const handleSave = useCallback((formValues: IProps) => {
    setProps(normalizeProps(formValues));
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(formValues));
  }, []);

  const handleValueChanged = useCallback(() => {
    handleSave(form.getFieldsValue());
  }, [form, handleSave]);

  useEffect(() => {
    let cachedProps: IProps | undefined = undefined;
    try {
      const cachedPropsStr = window.localStorage.getItem(CACHE_KEY);
      if (cachedPropsStr) {
        cachedProps = JSON.parse(cachedPropsStr);
      }
    } catch (e) {
      console.error('unable to decode cache:', e);
    }

    const newProps = {
      ...normalizeProps(DefaultBoxProps),
      ...cachedProps,
    };
    setProps(newProps);
    form.setFieldsValue(newProps);
  }, [form]);

  const handleReset = useCallback(() => {
    handleSave(DefaultBoxProps);
    form.setFieldsValue(normalizeProps(DefaultBoxProps));
  }, [form, handleSave]);

  const handleBoxesChange = useCallback((boxes: IBox<LabelType>[]) => {
    boxesRef.current = boxes;
  }, []);

  const handleImageNameChange = useCallback((imageName?: string) => {
    if (!imageName) {
      imageFileNameRef.current = 'image';
      return;
    }
    imageFileNameRef.current = imageName;
  }, []);

  const handleDownload = useCallback((consoleOnly = false) => {
    if (boxesRef.current.length === 0) {
      message.warning('No box found').then();
      return;
    }
    const values = form.getFieldsValue();
    const parser = OutputTypeMap[values._outputType || 'VOC_XML'];
    const output = parser.parse(values.labels, boxesRef.current, imageFileNameRef.current);
    console.log(output);
    if (consoleOnly) {
      return;
    }
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const imageFileName = imageFileNameRef.current.split('.').slice(0, -1).join('.');
    const fileName = `${imageFileName}${parser.ext}`;
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    link.remove();
  }, [form]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.config}>
        <Form form={form} onValuesChange={handleValueChanged} layout="inline">
          <Form.Item>
            <Button onClick={handleReset} danger>Reset</Button>
          </Form.Item>
          <Form.Item label="Labels" name="labels">
            <LabelsFormItem/>
          </Form.Item>
          <Form.Item label="Default label" name="defaultLabel">
            <Select style={{ minWidth: '120px' }} options={props?._labelOptions} showSearch/>
          </Form.Item>
          <Form.Item label="Width" name="width">
            <InputNumber min={320} precision={0} step={10}/>
          </Form.Item>
          <Form.Item label="Height" name="height">
            <InputNumber min={480} precision={0} step={10}/>
          </Form.Item>
          <Divider />
          <Form.Item label="Form" name="controls" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="File Selector" name="fileInputVisible" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Drag and Drop" name="allowDND" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Keyboard" name="allowKeyboard" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Mouse wheel" name="allowMouseWheel" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Keys Description" name="keysDescriptionVisible" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Divider />
          <Form.Item label="Output as" name="_outputType">
            <Radio.Group options={OutputTypes}/>
          </Form.Item>
          <Form.Item>
            <Button onClick={() => handleDownload()} onContextMenu={(e) => {
              e.preventDefault();
              handleDownload(true);
            }}>Download</Button>
          </Form.Item>
        </Form>
      </div>
      {props && <div className={styles.container}><Boxer {...props} onChange={handleBoxesChange}
        onImageNameChange={handleImageNameChange}/></div>}
    </div>
  );
}
