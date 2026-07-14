# Trayenco - Sistema de Gestión de Pedidos y Rutas

Sistema web de gestión integral para la empresa purificadora de agua Trayenco, comuna de Tomé.

## Tecnologías

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Node.js + Express
- **Base de datos:** PostgreSQL
- **Tiempo real:** Socket.io
- **Mapas:** Leaflet.js + OpenStreetMap
- **Contenedores:** Docker + Docker Compose
- **Proxy:** Nginx

## Estructura del proyecto

```
trayenco/
├── client/          # Frontend React
├── server/          # Backend Node.js + Express
├── postgres/        # Scripts iniciales de base de datos
├── nginx/           # Configuración del proxy inverso
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Levantar en desarrollo

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Levantar en producción

```bash
docker-compose up --build -d
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar los valores:

```bash
cp .env.example .env
```
