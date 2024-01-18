import { Empty } from 'antd';
import cls from 'classnames';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import useDragAndDrop from '../../hooks/useDragAndDrop.tsx';
import styles from './style.module.scss';

export interface IFile extends File {
  _url: string;
}

export interface IImageFileQueueProps {
  tick?: number;
  onNext?: (file: IFile) => void;
}

export default function ImageFileQueue({ tick, onNext }: IImageFileQueueProps): ReactElement {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [files, setFiles] = useState<IFile[]>([]);

  const handleDropFiles = useCallback((files: FileList) => {
    const newFiles = Array.from(files as unknown as IFile[]).map(file => {
      file._url = URL.createObjectURL(file);
      return file;
    });
    setFiles(newFiles);
    onNext?.(newFiles.shift()!);
  }, [onNext]);

  const handleClickImage = useCallback((file: IFile) => {
    onNext?.(file);
    setFiles(files.filter(f => f !== file));
  }, [files, onNext]);

  const { draggingOverDropZone } = useDragAndDrop(container, handleDropFiles);

  useEffect(() => {
    setFiles(files => {
      if (files.length === 0) {
        return files;
      }
      onNext?.(files[0]);
      return files.slice(1);
    });
  }, [onNext, tick]);

  return (
    <div
      ref={setContainer} 
      className={cls(styles.wrapper, draggingOverDropZone && styles.draggingOver, files.length === 0 && styles.noFile)}
    >
      {files.length === 0 ? <Empty className={styles.empty} description="Drop images here to open"/> :
        <>
          <div className={styles.counter}>{files.length}</div>
          <div className={styles.filesWrapper}>
            <div className={styles.files}>
              {files.map(file => <div key={file._url} className={styles.file} onClick={() => handleClickImage(file)}>
                <img className={styles.preview} src={file._url} alt={file.name}/>
              </div>)}
            </div>
          </div>
        </>
      }
    </div>
  );
}
