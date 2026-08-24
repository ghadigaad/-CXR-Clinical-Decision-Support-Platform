# EfficientNetV2-B0 inference for Hugging Face Docker Spaces.
# Build context is this directory: docker build -t cxr-efficientnet .
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=7860 \
    MODEL_WEIGHTS_PATH=weights/best_model_finetuned.keras \
    TF_CPP_MIN_LOG_LEVEL=2

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY weights ./weights

EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
