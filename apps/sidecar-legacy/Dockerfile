FROM runpod/pytorch:1.0.2-cu1281-torch280-ubuntu2404

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/models \
    TORCH_HOME=/models

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-pip curl ca-certificates git ffmpeg \
    libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 iproute2 && \
    rm -rf /var/lib/apt/lists/*

# Install cloudflared (Ubuntu 24.04 noble)
RUN curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared noble main" | \
      tee /etc/apt/sources.list.d/cloudflared.list >/dev/null && \
    apt-get update && apt-get install -y --no-install-recommends cloudflared && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

WORKDIR /app

# Use runtime requirements
COPY requirements.txt /app/requirements.txt
COPY main.py /app/main.py
COPY src /app/src
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Base image already provides torch 2.8.0 with CUDA 12.8.1; install app deps only
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt && \
    rm -rf ~/.cache/pip

ENTRYPOINT ["/app/entrypoint.sh"]


EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]


