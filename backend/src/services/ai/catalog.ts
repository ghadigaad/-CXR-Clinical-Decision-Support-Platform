/**
 * The models a clinician can choose at analysis time.
 *
 * Each id maps to a separate inference process. Adding a third classifier means a new
 * entry here, an env URL, and a RealAiProvider - the rest of the app stays unchanged.
 */

export const MODEL_IDS = ['densenet-cbam', 'efficientnetv2'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const DEFAULT_MODEL_ID: ModelId = 'densenet-cbam';

export interface ModelEvaluation {
  dataset: string;
  sampleCount: number | null;
  accuracy: number | null;
  perClass: {
    label: string;
    precision: number;
    recall: number;
    f1: number;
    auc: number;
    support: number;
  }[];
  caveat: string;
}

export interface ModelDefinition {
  id: ModelId;
  name: string;
  shortName: string;
  description: string;
  isDefault: boolean;
  evaluation: ModelEvaluation;
}

export const MODEL_CATALOG: Record<ModelId, ModelDefinition> = {
  'densenet-cbam': {
    id: 'densenet-cbam',
    name: 'DenseNet-121 + CBAM',
    shortName: 'DenseNet',
    description:
      'CXR-domain pretrained DenseNet-121 with CBAM attention. Measured on the Kermany 2018 pediatric test split.',
    isDefault: true,
    evaluation: {
      dataset: 'Kermany 2018 chest X-ray test split',
      sampleCount: 624,
      accuracy: 0.891,
      perClass: [
        { label: 'Normal', precision: 0.99, recall: 0.87, f1: 0.92, auc: 0.9913, support: 234 },
        {
          label: 'Bacterial Pneumonia',
          precision: 0.91,
          recall: 0.92,
          f1: 0.92,
          auc: 0.9774,
          support: 242,
        },
        { label: 'Viral Pneumonia', precision: 0.75, recall: 0.88, f1: 0.81, auc: 0.954, support: 148 },
      ],
      caveat:
        'These figures describe performance on a single public pediatric test split and are not a ' +
        'guarantee of accuracy on other patient populations, scanners, or acquisition protocols.',
    },
  },
  efficientnetv2: {
    id: 'efficientnetv2',
    name: 'EfficientNetV2-B0',
    shortName: 'EfficientNet',
    description:
      'ImageNet-pretrained EfficientNetV2-B0 fine-tuned on Kermany. Pediatric-trained; adult films may be out of distribution.',
    isDefault: false,
    evaluation: {
      dataset: 'Kermany 2018 chest X-ray (pediatric)',
      sampleCount: null,
      accuracy: null,
      perClass: [],
      caveat:
        'This checkpoint is from an interrupted fine-tune (stage 2, epoch 5). Independent ' +
        'per-class test metrics are not available. The backbone was ImageNet-pretrained, not ' +
        'CXR-domain pretrained, so performance on adult chest X-rays is expected to differ from DenseNet.',
    },
  },
};

export function isModelId(value: string): value is ModelId {
  return (MODEL_IDS as readonly string[]).includes(value);
}

/** Human-readable name from a stored modelVersion string, for historical records. */
export function modelNameFromVersion(version: string): string {
  if (version.includes('efficientnet')) return MODEL_CATALOG.efficientnetv2.name;
  if (version.includes('densenet')) return MODEL_CATALOG['densenet-cbam'].name;
  if (version.startsWith('MOCK')) return 'Development stub';
  return version;
}
