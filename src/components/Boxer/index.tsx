import { Table } from 'antd';
import cls from 'classnames';
import { debounce } from 'lodash';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BoxerStage, { ClientRect, IBox } from '../../core/BoxerStage.ts';
import KeysDescription from './components/KeysDescription.tsx';
import useDragAndDrop from '../../hooks/useDragAndDrop.tsx';
import useKeyboard from './hooks/useKeyboard.tsx';
import useMouseWheel from './hooks/useMouseWheel.ts';
import useTable from './hooks/useTable.tsx';
import styles from './style.module.scss';

export type ClientRectWithLabel<LABEL extends string> = ClientRect & { label: LABEL };

export interface IBoxerProps<LABEL extends string> {
  className?: string;
  labels: LABEL[];
  defaultLabel: LABEL;
  width?: number;
  height?: number;
  /**
   * The table of information of all boxes
   */
  tableVisible?: boolean;
  /**
   * Description of keyboard and mouse controls
   */
  keysDescriptionVisible?: boolean;
  /**
   * The URL of an image which is default loaded into canvas
   */
  imageURL?: string;
  /**
   * DND = Drag and Drop
   */
  allowDND?: boolean;
  /**
   * Allow keyboard shortcuts/hotkeys
   */
  allowKeyboard?: boolean;
  /**
   * Allow mouse wheel to zoom in or out canvas and move canvas
   */
  allowMouseWheel?: boolean;
  onChange?: (boxes: IBox<LABEL>[]) => void;
  onImageNameChange?: (imageName?: string) => void;
  onPredicate?: (imageURL: string) => Promise<ClientRectWithLabel<LABEL>[]>;
}

export const PredicationCache: Record<string, ClientRectWithLabel<string>[]> = {};

export default function Boxer<LABEL extends string = string>({
  labels,
  defaultLabel,
  width = 500,
  height = 500,
  tableVisible,
  className,
  imageURL,
  keysDescriptionVisible,
  allowDND,
  allowKeyboard,
  allowMouseWheel,
  onChange,
  onImageNameChange,
  onPredicate,
}: IBoxerProps<LABEL>): React.ReactElement {
  const id = useMemo(() => `BoxWrapper_${Date.now()}_${Math.floor(Math.random() * 10000)}`, []);

  const imageURLRef = useRef<string | undefined>(imageURL);
  const stageRef = useRef<BoxerStage<LABEL> | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

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
    // if (!imageURL || imageURLRef.current === imageURL) {
    //   return;
    // }
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

    const drawBoxes = (rects: ClientRectWithLabel<LABEL>[]) => {
      rects.forEach(rect => {
        const box = stageRef.current?.drawBox(rect.x, rect.y, rect.width, rect.height, rect.label);
        box?.normalize();
      });
      setBoxes(stageRef.current?.getBoxes() || []);
      stageRef.current?.highlight();
    };

    if (PredicationCache[imageURL]) {
      drawBoxes(PredicationCache[imageURL] as ClientRectWithLabel<LABEL>[]);
    } else {
      PredicationCache[imageURL] = [];
      setLoading(true);
      onPredicate?.(imageURL).then(rects => {
        PredicationCache[imageURL] = rects;
        // image has changed
        if (imageURL !== imageURLRef.current) {
          return;
        }
        drawBoxes(rects);
      }).catch(() => {
        delete PredicationCache[imageURL];
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [onImageNameChange, onPredicate, setBoxes]);

  useKeyboard(id, container, stageRef, allowKeyboard);
  useMouseWheel(container, stageRef, allowMouseWheel);

  const handleDropFile = useCallback((files: FileList) => {
    const file = files[0];
    setBackgroundImage(window.URL.createObjectURL(file), file.name);
  }, [setBackgroundImage]);

  const { draggingOverDropZone } = useDragAndDrop(container, handleDropFile, allowDND);

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
      setBoxes(stage.getBoxes('_id'));
    }, 100, {
      leading:  false,
      trailing: true,
    }));

    stageRef.current = stage;

    if (imageURLRef.current) {
      setBackgroundImage(imageURLRef.current);
    }

    return (): void => {
      stage.dispose();
      setBoxes([]);
    };
  }, [container, defaultLabel, height, setBackgroundImage, setBoxes, width]);

  const { columns, scroll, rowSelection, onRow } = useTable(stageRef, labels, height);

  return <div id={id} className={styles.wrapper}>
    <div className={cls(styles.canvas, draggingOverDropZone && styles.dnd)}>
      <div className={cls(styles.container, className)} tabIndex={0} ref={setContainer}/>
    </div>
    {keysDescriptionVisible && (allowKeyboard ? <KeysDescription /> : 'Keyboard is NOT enabled')}
    {tableVisible &&
      <Table<IBox<LABEL>>
        className={styles.controls}
        rowKey="_id"
        loading={loading}
        columns={columns}
        dataSource={boxes}
        scroll={scroll}
        rowSelection={rowSelection}
        pagination={false}
        onRow={onRow}
      />
    }
  </div>;
}
