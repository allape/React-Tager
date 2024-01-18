import { useEffect, useState } from 'react';

export interface IUseDragAndDrop {
  draggingOverDropZone: boolean;
}

export default function useDragAndDrop(
  container: HTMLDivElement | null,
  onDropFiles: (files: FileList) => void,
  enabled = true,
): IUseDragAndDrop {
  const [draggingOverDropZone, setDraggingOverDropZone] = useState<boolean>(false);
  useEffect(() => {
    if (!enabled || !container) {
      return undefined;
    }

    const handleDropEnter = (e: DragEvent) => {
      e.preventDefault();
      setDraggingOverDropZone(true);
    };
    const handleDropLeave = (e: DragEvent) => {
      e.preventDefault();
      setDraggingOverDropZone(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDraggingOverDropZone(false);

      if (!e.dataTransfer?.files.length) {
        return;
      }
      onDropFiles(e.dataTransfer.files);
    };

    container.addEventListener('dragenter', handleDropEnter, true);
    container.addEventListener('dragover', handleDropEnter, true);
    container.addEventListener('dragleave', handleDropLeave, true);
    container.addEventListener('drop', handleDrop, true);
    return () => {
      container.removeEventListener('dragenter', handleDropEnter, true);
      container.removeEventListener('dragover', handleDropEnter, true);
      container.removeEventListener('dragleave', handleDropLeave, true);
      container.removeEventListener('drop', handleDrop, true);
    };
  }, [enabled, container, onDropFiles]);

  return { draggingOverDropZone: draggingOverDropZone };
}
