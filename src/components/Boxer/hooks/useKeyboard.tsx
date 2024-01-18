import { MutableRefObject, useEffect } from 'react';
import BoxerStage from '../../../core/BoxerStage.ts';

export default function useKeyboard(
  id: string,
  container: HTMLDivElement | null, 
  stageRef: MutableRefObject<BoxerStage | null>, 
  enabled = true,
): void {
  useEffect(() => {
    if (!container || !enabled) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent): void => {
      const stage = stageRef.current;
      switch (e.key) {
      case 'Tab': {
        e.preventDefault();
        const highlightedBox = stage?.highlight(e.shiftKey ? 'prev' : 'next');
        if (highlightedBox) {
          const row = window.document.querySelector(`#${id} [data-row-key="` + highlightedBox._id + '"]');
          row?.scrollIntoView({
            behavior: 'smooth',
          });
        }
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const box = stage?.getTopBox();
        if (!box) {
          break;
        }
        stage?.highlight();
        box.dispose();
        break;
      }
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        const box = stage?.getTopBox();
        if (!box) {
          break;
        }
        e.preventDefault();
        const x = box.x();
        const y = box.y();
        const step = e.ctrlKey || e.metaKey ? 10 : 1;
        const deltaX = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const deltaY = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        if (e.shiftKey) {
          box.setAttr('width', box.width() + deltaX);
          box.setAttr('height', box.height() + deltaY);
        } else {
          box.setAttr('x', x + deltaX);
          box.setAttr('y', y + deltaY);
        }
        box.normalize();
        break;
      }
      }
    };
    container.addEventListener('keydown', handleKeyDown);
    return (): void => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [container, enabled, id, stageRef]);
}
