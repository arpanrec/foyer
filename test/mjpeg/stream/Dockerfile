FROM docker.io/library/node:26-alpine
RUN apk add --no-cache ffmpeg
COPY serve.ts /serve.ts
EXPOSE 8090
CMD ["node", "/serve.ts"]
