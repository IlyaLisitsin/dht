# DHT — PDF Text Extractor

```bash
echo "DOCKER_GID=$(getent group docker | cut -d: -f3)" > .env
docker compose --profile build build parser
docker compose up --build
```

http://localhost:3000
