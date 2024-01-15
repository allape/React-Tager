import { IBox } from '../core/BoxerStage.ts';

export type OutputType = 'VOC_XML' | 'YOLO_TXT';

export type ParseFunc = (labels: string[],boxes: IBox[], imageName: string) => string;

export interface IOutputType extends ILabeledValue<OutputType> {
  ext: string;
  parse: ParseFunc;
}

function convert2YOLO(box: IBox): [number, number, number, number] {
  const backgroundImage = box.boxer.getBackgroundImage();
  if (!backgroundImage) {
    return [0, 0, 0, 0];
  }

  // eslint-disable-next-line max-len
  // box = (float(xmlbox.find('xmin').text), float(xmlbox.find('xmax').text), float(xmlbox.find('ymin').text), float(xmlbox.find('ymax').text))
  // def convert(size, box):
  //     dw = 1./(size[0])
  //     dh = 1./(size[1])
  //     x = (box[0] + box[1])/2.0 - 1
  //     y = (box[2] + box[3])/2.0 - 1
  //     w = box[1] - box[0]
  //     h = box[3] - box[2]
  //     x = x*dw
  //     w = w*dw
  //     y = y*dh
  //     h = h*dh
  //     return (x,y,w,h)
  // to js
  const dw = 1 / backgroundImage.width();
  const dh = 1 / backgroundImage.height();
  const x = (box.x() * 2 + box.width()) / 2.0 - 1;
  const y = (box.y() * 2 + box.height()) / 2.0 - 1;
  const w = box.width();
  const h = box.height();
  return [x * dw, y * dh, w * dw, h * dh];
}

export const OutputTypes: IOutputType[] = [
  {
    label: 'VOC annotation XML',
    value: 'VOC_XML',
    ext:   '.xml',
    parse: (_: string[], boxes: IBox[], imageName: string) => {
      if (!boxes.length) {
        return '<annotation></annotation>';
      }

      const root = document.implementation.createDocument(null, 'annotation');

      const filename = root.createElement('filename');
      filename.textContent = imageName;

      const folder = root.createElement('folder');
      folder.textContent = `VOC${new Date().getFullYear()}`;

      root.documentElement.append(filename, folder);
      root.documentElement.append(folder);

      for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const object = root.createElement('object');

        const name = root.createElement('name');
        name.textContent = box.label;

        // VOC object in xml
        const bndbox = root.createElement('bndbox');
        const xmin = root.createElement('xmin');
        xmin.textContent = box.x().toString();
        const ymin = root.createElement('ymin');
        ymin.textContent = box.y().toString();
        const xmax = root.createElement('xmax');
        xmax.textContent = (box.x() + box.width()).toString();
        const ymax = root.createElement('ymax');
        ymax.textContent = (box.y() + box.height()).toString();
        bndbox.append(xmin, ymin, xmax, ymax);

        object.append(name, bndbox);
        root.documentElement.append(object);
      }

      // VOC image size
      const size = root.createElement('size');
      const width = root.createElement('width');
      width.textContent = boxes[0].boxer.getBackgroundImage()?.width().toString() || '';
      const height = root.createElement('height');
      height.textContent = boxes[0].boxer.getBackgroundImage()?.height().toString() || '';
      const depth = root.createElement('depth');
      depth.textContent = '3';
      size.append(width, height, depth);
      root.documentElement.append(size);

      return new XMLSerializer().serializeToString(root);
    },
  },
  {
    label: 'YOLO annotation text',
    value: 'YOLO_TXT',
    ext:   '.txt',
    parse: (labels: string[], boxes) => {
      if (!boxes.length) {
        return '';
      }
      return boxes.map((box) => {
        const [x, y, w, h] = convert2YOLO(box);
        return `${labels.indexOf(box.label)} ${x} ${y} ${w} ${h}`;
      }).join('\n');
    },
  },
];

export const OutputTypeMap: Record<OutputType, IOutputType> = OutputTypes.reduce((map, type) => {
  map[type.value] = type;
  return map;
}
, {} as Record<OutputType, IOutputType>);
