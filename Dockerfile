# Image ringan: cuma Node + file statis. Tidak install Electron / dependency apa pun.
FROM node:20-alpine
WORKDIR /app
COPY index.html styles.css app.js server.js ./
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
