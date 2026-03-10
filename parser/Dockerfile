FROM python:3.12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -r -u 10001 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY parse.py .

USER 10001
ENTRYPOINT ["python", "/app/parse.py"]
