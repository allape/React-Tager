import { MutableRefObject, useEffect } from 'react';
import BoxerStage, { ILayerEvent } from '../../../core/BoxerStage.ts';

export default function useMouseWheel(
  container: HTMLDivElement | null,
  stageRef: MutableRefObject<BoxerStage | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!container || !enabled) {
      return undefined;
    }
    
    const handleWheel = (e: WheelEvent & Partial<ILayerEvent>): void => {
      e.preventDefault();
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        let scale = stage.getZoom();
        scale = scale - e.deltaY / 100;
        stage.zoom(scale, { x: e.layerX || 0, y: e.layerY || 0 });
        return;
      }
      stage.moveDelta({ x: -e.deltaX, y: -e.deltaY });
    };
    container.addEventListener('wheel', handleWheel);
    return (): void => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [container, enabled, stageRef]);
}
