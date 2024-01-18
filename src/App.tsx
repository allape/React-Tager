import { Button, Divider, Form, InputNumber, message, Popconfirm, Radio, Select, Switch, Tooltip } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './App.module.scss';
import Boxer, { IBoxerProps } from './components/Boxer';
import ImageFileQueue, { IFile } from './components/ImageFileQueue';
import LabelsFormItem from './components/LabelsFormItem';
import ScriptFormItem from './components/ScriptFormItem';
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
  _predicateScript?: string;
  _allowPredication?: boolean;
  _allowQueue?: boolean;
  _labelOptions?: ILabeledValue[];
  _outputType?: OutputType;
}

export const DefaultBoxProps: IProps = {
  labels:                 LABELS,
  defaultLabel:           LABELS[0],
  width:                  500,
  height:                 500,
  imageURL:               'http://127.0.0.1:3001/demo.jpg',
  allowDND:               true,
  allowKeyboard:          true,
  allowMouseWheel:        true,
  tableVisible:           true,
  keysDescriptionVisible: true,
  _outputType:            'YOLO_TXT',
  _allowQueue:            true,
  _allowPredication:      true,
  _predicateScript:       `
    return (async () => {
      const blob = await fetch(imageURL).then(res => res.blob());
      const formData = new FormData();
      formData.set('file', blob);
      const res = await fetch('http://127.0.0.1:8000/predicate', { 
        method: 'post',
        body: formData,
      }).then(res => res.json());
      return res.boxes.filter(i => i[1] >= 0.3).map(rect => ({ 
        label: labels[rect[0]], 
        x: rect[2][0], 
        y: rect[2][1], 
        width: rect[3][0] - rect[2][0], 
        height: rect[3][1] - rect[2][1] 
      }));
    })(imageURL, labels)
  `,
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
  const fileSelectorRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [props, setProps] = useState<IProps | undefined>(undefined);

  const [queueTick, setQueueTick] = useState<number>(0);

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
    if (!imageName || !imageName.includes('.')) {
      imageFileNameRef.current = imageFileNameRef.current || 'image';
      return;
    }
    imageFileNameRef.current = imageName;
  }, []);

  const handleDownload = useCallback((consoleOnly = false) => {
    const values = form.getFieldsValue();
    try {
      if (boxesRef.current.length === 0) {
        message.warning('No box found').then();
        return;
      }
      setLoading(true);
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
    } finally {
      setLoading(false);
      if (values._allowQueue) {
        setQueueTick(tick => tick + 1);
      }
    }
  }, [form]);
  
  const handleOpenButtonClick = useCallback(() => {
    fileSelectorRef.current?.click();
  }, []);

  const handleOnFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (!files || !files.length) {
      return;
    }
    const file = files[0];
    setProps(p => ({
      ...p!,
      imageURL: window.URL.createObjectURL(file),
    }));
    imageFileNameRef.current = file.name;
    e.target.value = '';
  }, []);

  const handlePredicate = useCallback<Exclude<IProps['onPredicate'], undefined>>(async (imageURL: string) => {
    try {
      const values = form.getFieldsValue();
      if (!values._allowPredication) return [];
      const predicateScript = values._predicateScript;
      if (!predicateScript) {
        return [];
      }
      return await (new Function('imageURL', 'labels', predicateScript))(imageURL, values.labels);
    } catch (e) {
      console.log('unable to predicate:', e, imageURL);
      throw e;
    }
  }, [form]);

  const handleQueueNext = useCallback((file: IFile) => {
    setProps(props => ({
      ...props!,
      imageURL: file._url,
    }));
    imageFileNameRef.current = file.name;
  }, []);

  useEffect(() => {
    if (!props?.allowKeyboard) {
      return undefined;
    }
    const handleKeydown = (e: KeyboardEvent): void => {
      switch (e.key) {
      case 'Enter': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleDownload(e.shiftKey);
        }
        break;
      }
      case 'o':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleOpenButtonClick();
        }
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [handleDownload, handleOpenButtonClick, props?.allowKeyboard]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.config}>
        <Form form={form} onValuesChange={handleValueChanged} layout="inline">
          <Form.Item>
            <Popconfirm
              title="Reset now?"
              onConfirm={handleReset}
              okText="Reset"
              cancelText="Not now"
              okButtonProps={{ danger: true }}>
              <Button danger>Reset</Button>
            </Popconfirm>
          </Form.Item>
          <Form.Item label="Predicate Script" name="_predicateScript">
            <ScriptFormItem />
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
          <Divider/>
          <Form.Item label="Image Queue" name="_allowQueue" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Predication" name="_allowPredication" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Info Table" name="tableVisible" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Drag and Drop" name="allowDND" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Keyboard" name="allowKeyboard" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Mouse Wheel" name="allowMouseWheel" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Form.Item label="Keys Description" name="keysDescriptionVisible" valuePropName="checked">
            <Switch/>
          </Form.Item>
          <Divider/>
          <Form.Item>
            <Tooltip title={props?.allowKeyboard ? '[Ctrl/Cmd] + [O]' : ''}>
              <Button onClick={handleOpenButtonClick}>
                Open Image
              </Button>
            </Tooltip>
          </Form.Item>
          <Form.Item label="Output as" name="_outputType">
            <Radio.Group options={OutputTypes}/>
          </Form.Item>
          <Form.Item>
            <Tooltip title={props?.allowKeyboard ? '[Ctrl/Cmd] + [Enter]' : ''}>
              <Button
                loading={loading}
                onClick={() => handleDownload()}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleDownload(true);
                }}>
                Download
              </Button>
            </Tooltip>
          </Form.Item>
        </Form>
        <input ref={fileSelectorRef} className={styles.fileSelector} type="file" onChange={handleOnFileChange}/>
      </div>
      {props?._allowQueue && <ImageFileQueue tick={queueTick} onNext={handleQueueNext} />}
      {props && (<div className={styles.container}>
        <Boxer
          {...props}
          onChange={handleBoxesChange}
          onImageNameChange={handleImageNameChange}
          onPredicate={handlePredicate}
        />
      </div>)}
    </div>
  );
}
