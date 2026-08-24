# DenseNet-121 + CBAM inference for Hugging Face Docker Spaces.
# Build context is this directory: docker build -t cxr-densenet .
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=7860 \
    DEVICE=cpu \
    MODEL_WEIGHTS_PATH=weights/best_model.pt

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.5.1 torchvision==0.20.1 \
        --index-url https://download.pytorch.org/whl/cpu \
    && grep -vE '^(torch|torchvision)==' requirements.txt > /tmp/req.txt \
    && pip install --no-cache-dir -r /tmp/req.txt

COPY app ./app
COPY weights ./weights

EXPOSE 7860

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
