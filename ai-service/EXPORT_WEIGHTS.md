# Exporting model weights from Colab

The training notebook saves its best checkpoint as `best_model.pt` inside the Colab
runtime. That file disappears when the runtime is recycled and is not part of this
repository, so it has to be exported once and placed here.

## 1. Download from Colab

After training finishes (the cell that prints `-> saved new best model`), run a new cell:

```python
from google.colab import files
files.download("best_model.pt")
```

If the download is blocked by the browser, save it to Drive instead:

```python
from google.colab import drive
drive.mount("/content/drive")
!cp best_model.pt /content/drive/MyDrive/best_model.pt
```

## 2. Place the file

Move the downloaded checkpoint to:

```
ai-service/weights/best_model.pt
```

Or put it anywhere and point `MODEL_WEIGHTS_PATH` in `ai-service/.env` at it.

## 3. Verify it loads

```bash
cd ai-service
.venv\Scripts\activate
python -m app.verify_weights
```

The script builds the architecture, loads the state dict strictly, runs one dummy
forward pass, and prints the resolved model version. Any key mismatch is reported with
the specific missing or unexpected keys instead of a generic failure.

Then start the service and check health:

```bash
uvicorn app.main:app --port 8000
curl http://localhost:8000/health
```

`"model_loaded": true` means inference is live.

## What the checkpoint must contain

A plain `state_dict` saved with `torch.save(model.state_dict(), "best_model.pt")` for the
notebook's `DenseNetCBAM3Class`. The loader also accepts a wrapper dict containing a
`state_dict`, `model_state_dict`, or `model` key, and transparently strips a
`module.` prefix left behind by `nn.DataParallel`.

Expected top-level key groups:

| Prefix | Source |
| ------ | ------ |
| `features.*` | DenseNet-121 backbone from `torchxrayvision` |
| `cbam.mlp.*`, `cbam.spatial_conv.*` | CBAM attention block (1024 channels) |
| `classifier.2.*` | `Linear(1024, 3)` inside the `Sequential` head |

The final layer must have shape `[3, 1024]` — three classes, in this order:

1. `Normal`
2. `Bacterial Pneumonia`
3. `Viral Pneumonia`

## If the architecture changes

`app/model/architecture.py` is a direct port of the notebook's model definition. If you
retrain with a modified architecture, update that file to match before exporting a new
checkpoint, otherwise loading will fail with key or shape mismatches.

Changing the class list also requires updating `CLASS_NAMES` in
`app/model/architecture.py` and the label mapping the backend uses in
`backend/src/services/reportBuilder.ts`.
