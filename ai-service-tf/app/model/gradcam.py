"""Grad-CAM for the Keras EfficientNetV2B0 classifier.

Ported from the notebook's make_gradcam_heatmap with two server-oriented changes: the
gradient sub-model is built once and reused instead of per request, and inputs are passed
as a list so Keras 3 does not warn about mismatched input structure on every call.

The colour ramp and PNG encoding are byte-for-byte the same as the PyTorch service's, so
a clinician switching models sees heatmaps drawn on identical terms.
"""

from __future__ import annotations

import base64
import io

import keras
import numpy as np
import tensorflow as tf
from PIL import Image

from .preprocessing import INPUT_SIZE


def find_last_conv_layer(model: keras.Model) -> str:
    """Last layer producing a 4-D feature map - the standard Grad-CAM target."""
    for layer in reversed(model.layers):
        try:
            if len(layer.output.shape) == 4:
                return layer.name
        except AttributeError:
            continue
    raise RuntimeError("No 4-D feature map layer found; cannot attach Grad-CAM.")


class GradCAM:
    def __init__(self, model: keras.Model, target_layer_name: str | None = None):
        self.model = model
        self.target_layer_name = target_layer_name or find_last_conv_layer(model)
        self.grad_model = keras.models.Model(
            model.inputs,
            [model.get_layer(self.target_layer_name).output, model.output],
        )

    def generate(
        self, batch: np.ndarray, class_idx: int | None = None
    ) -> tuple[np.ndarray, np.ndarray]:
        """Return (normalized CAM, probabilities) from a single forward/backward pass.

        The probabilities come from the same pass that produced the CAM, so the heatmap
        always corresponds to the numbers that get reported.
        """
        inputs = tf.convert_to_tensor(batch)

        with tf.GradientTape() as tape:
            conv_outputs, predictions = self.grad_model([inputs], training=False)
            if class_idx is None:
                class_idx = int(tf.argmax(predictions[0]).numpy())
            class_channel = predictions[:, class_idx]

        grads = tape.gradient(class_channel, conv_outputs)
        if grads is None:
            raise RuntimeError("Grad-CAM produced no gradients for the target layer.")

        pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
        cam = tf.reduce_sum(conv_outputs[0] * pooled, axis=-1)
        cam = tf.nn.relu(cam).numpy()

        span = float(cam.max() - cam.min())
        if span < 1e-8:
            # A flat map carries no localization signal; return zeros rather than
            # amplifying numerical noise into a convincing-looking heatmap.
            cam = np.zeros_like(cam)
        else:
            cam = (cam - cam.min()) / span

        resized = np.asarray(
            Image.fromarray((cam * 255).astype(np.uint8)).resize(
                (INPUT_SIZE, INPUT_SIZE), Image.BILINEAR
            ),
            dtype=np.float32,
        ) / 255.0

        return resized, predictions[0].numpy()


def _jet_colormap(values: np.ndarray) -> np.ndarray:
    r = np.clip(1.5 - np.abs(4 * values - 3), 0, 1)
    g = np.clip(1.5 - np.abs(4 * values - 2), 0, 1)
    b = np.clip(1.5 - np.abs(4 * values - 1), 0, 1)
    return np.stack([r, g, b], axis=-1)


def cam_to_png_data_url(cam: np.ndarray, size: tuple[int, int]) -> str:
    """Render a CAM as a transparent-background RGBA PNG data URL at ``size``."""
    rgb = (_jet_colormap(cam) * 255).astype(np.uint8)
    alpha = (np.clip(cam, 0, 1) ** 0.85 * 235).astype(np.uint8)
    rgba = np.dstack([rgb, alpha])

    overlay = Image.fromarray(rgba, mode="RGBA").resize(size, Image.BILINEAR)

    buffer = io.BytesIO()
    overlay.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
