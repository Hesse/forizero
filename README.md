# Echo API Service

A simple Express.js API service that includes request logging and an echo endpoint.

## Features

- Request logging using Morgan middleware
- JSON body parsing
- Echo endpoint that returns POST request body

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### POST /echo
Echoes back the JSON body sent in the request.

Example:
```bash
curl -X POST \
  http://localhost:3000/echo \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello, World!"}'
```