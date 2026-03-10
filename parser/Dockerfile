FROM python:3.12-slim

RUN useradd -r -u 10001 appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY parse.py .

USER 10001
ENTRYPOINT ["python", "/app/parse.py"]
