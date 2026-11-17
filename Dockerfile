FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-numpy \
    python3-pil \
    fonts-dejavu-core \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN mkdir -p generated cache/audio/names cache/audio/segments
ENV PORT=3456
EXPOSE 3456
CMD ["node", "server.js"]
