"""Grad-CAM explainability for DenseNetCBAM3Class.

Ported from the notebook, with two changes needed for a long-running server:
``register_full_backward_hook`` replaces the deprecated ``register_backward_hook``
(which reports gradients unreliably for modules with multiple inputs), and hooks are
registered once per model instance rather than per request so repeated calls do not
accumulate handles.
"""

from __future__ import annotations

import base64
import io

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

from .architecture import INPUT_SIZE


class GradCAM:
    """Gradient-weighted class activation mapping on a single target layer."""

    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.target_layer = target_layer
        self.gradients: torch.Tensor | None = None
        self.activations: torch.Tensor | None = None

        self._handles = [
            target_layer.register_forward_hook(self._save_activation),
            target_layer.register_full_backward_hook(self._save_gradient),
        ]

    def _save_activation(self, module, inputs, output) -> None:
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output) -> None:
        self.gradients = grad_output[0].detach()

    def generate(
        self, input_tensor: torch.Tensor, class_idx: int | None = None
    ) -> tuple[np.ndarray, torch.Tensor]:
        """Run one forward/backward pass and return (normalized CAM, logits).

        The logits come from the same pass that produced the CAM, so the heatmap always
        corresponds to the probabilities that get reported.
        """
        self.model.eval()
        self.model.zero_grad(set_to_none=True)

        logits = self.model(input_tensor)
        if class_idx is None:
            class_idx = int(logits.argmax(dim=1).item())

        logits[:, class_idx].sum().backward()

        if self.gradients is None or self.activations is None:
            raise RuntimeError("Grad-CAM hooks did not capture activations or gradients.")

        weights = self.gradients.mean(dim=(2, 3), keepdim=True)
        cam = F.relu((weights * self.activations).sum(dim=1, keepdim=True))
        cam = F.interpolate(
            cam, size=(INPUT_SIZE, INPUT_SIZE), mode="bilinear", align_corners=False
        )

        cam_np = cam.squeeze().detach().cpu().numpy()
        span = float(cam_np.max() - cam_np.min())
        if span < 1e-8:
            # A perfectly flat map carries no localization signal; return zeros rather
            # than amplifying numerical noise into a convincing-looking heatmap.
            cam_np = np.zeros_like(cam_np)
        else:
            cam_np = (cam_np - cam_np.min()) / span

        return cam_np, logits.detach()

    def close(self) -> None:
        for handle in self._handles:
            handle.remove()
        self._handles = []


def _jet_colormap(values: np.ndarray) -> np.ndarray:
    """Map [0, 1] intensities to the standard jet RGB ramp used in the notebook plots."""
    r = np.clip(1.5 - np.abs(4 * values - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * values - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * values - 1), 0, 1)
    return np.stack([r, g, b], axis=-1)


def cam_to_png_data_url(cam: np.ndarray, size: tuple[int, int]) -> str:
    """Render a CAM as a transparent-background RGBA PNG data URL at ``size``.

    Alpha tracks activation strength so cold regions stay see-through and the clinician
    can read the underlying anatomy. Overall opacity is controlled in the UI.
    """
    rgb = (_jet_colormap(cam) * 255).astype(np.uint8)
    alpha = (np.clip(cam, 0, 1) ** 0.85 * 235).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])

    overlay = Image.fromarray(rgba, mode="RGBA").resize(size, Image.BILINEAR)

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
