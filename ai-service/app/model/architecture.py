"""Model definition ported from Pneumonia_CBAM_DenseNet_CXR.ipynb.

The layer names here are part of the checkpoint contract: renaming any attribute
breaks state-dict loading for weights trained with the notebook.
"""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F

CLASS_NAMES = ["Normal", "Bacterial Pneumonia", "Viral Pneumonia"]
NUM_CLASSES = len(CLASS_NAMES)

FEATURE_CHANNELS = 1024  # DenseNet-121 final feature depth
INPUT_SIZE = 224


class CBAM(nn.Module):
    """Convolutional Block Attention Module: channel attention then spatial attention."""

    def __init__(self, channels: int, reduction: int = 16, spatial_kernel: int = 7):
        super().__init__()
        hidden = max(channels // reduction, 8)
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.mlp = nn.Sequential(
            nn.Conv2d(channels, hidden, 1, bias=False),
            nn.ReLU(inplace=True),
            nn.Conv2d(hidden, channels, 1, bias=False),
        )
        self.spatial_conv = nn.Conv2d(
            2, 1, spatial_kernel, padding=spatial_kernel // 2, bias=False
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        ch_att = self.sigmoid(self.mlp(self.avg_pool(x)) + self.mlp(self.max_pool(x)))
        x = x * ch_att

        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        sp_att = self.sigmoid(self.spatial_conv(torch.cat([avg_out, max_out], dim=1)))
        return x * sp_att


def build_backbone(pretrained_source: str, download_pretrained: bool = False) -> nn.Module:
    """Return the DenseNet-121 feature extractor.

    For serving, ``download_pretrained`` stays False: every parameter comes from our own
    checkpoint, so fetching the upstream pretrained weights first would only add a slow
    network call at startup. The notebook sets it True because it starts from those
    weights before fine-tuning.
    """
    if pretrained_source == "cxr":
        import torchxrayvision as xrv

        model = xrv.models.DenseNet(weights="all" if download_pretrained else None)
        return model.features

    import torchvision.models as tv

    weights = tv.DenseNet121_Weights.IMAGENET1K_V1 if download_pretrained else None
    return tv.densenet121(weights=weights).features


class DenseNetCBAM3Class(nn.Module):
    """DenseNet-121 backbone + CBAM attention + 3-class head."""

    def __init__(self, pretrained_source: str = "cxr", download_pretrained: bool = False):
        super().__init__()
        self.features = build_backbone(pretrained_source, download_pretrained)
        self.cbam = CBAM(channels=FEATURE_CHANNELS)
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(FEATURE_CHANNELS, NUM_CLASSES),
        )
        self.gradcam_layer = self.cbam

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.features(x)
        x = F.relu(x, inplace=True)
        x = self.cbam(x)
        x = self.pool(x)
        return self.classifier(x)
