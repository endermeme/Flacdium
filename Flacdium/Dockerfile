FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends gosu ffmpeg libchromaprint-tools \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 flacdium \
    && useradd --system --uid 10001 --gid 10001 --create-home flacdium

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY docker/entrypoint.sh /entrypoint.sh
COPY README.md .
RUN mkdir -p data library covers tmp \
    && chown -R flacdium:flacdium /app /entrypoint.sh \
    && chmod 755 /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
