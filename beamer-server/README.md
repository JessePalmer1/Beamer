# Beamer Server

Secure FastAPI server that proxies Google Maps API calls to protect API keys from client exposure.

## Features

- 🔒 **Secure API Key Management** - Google API keys stored server-side only
- 🚀 **FastAPI Endpoints** - Modern async API with automatic documentation
- 🛡️ **Rate Limiting** - Basic protection against API abuse (60 requests/minute per IP)
- 📍 **Google Places Proxy** - Autocomplete and place details
- 🗺️ **Google Directions Proxy** - Route calculation
- 🔑 **Maps Key Endpoint** - Secure key delivery for JavaScript maps

## Quick Start

1. **Install Dependencies**
   ```bash
   cd beamer-server
   uv sync
   ```

2. **Set Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Google API keys
   ```

3. **Run Server**
   ```bash
   uv run python server.py
   ```

4. **Test Health Check**
   ```bash
   curl http://localhost:8000/
   ```

## API Endpoints

### Health Check
- `GET /` - Server status

### Google Places API Proxy
- `POST /api/places/autocomplete` - Location search suggestions
- `POST /api/places/details` - Get coordinates for a place

### Google Directions API Proxy  
- `POST /api/directions` - Get driving directions between two points

### Maps JavaScript API
- `GET /api/maps-key` - Get Maps API key for client-side maps

## Security Features

1. **API Keys Protected** - Never exposed to client applications
2. **Rate Limiting** - 60 requests per minute per IP address
3. **CORS Configuration** - Restrict origins in production
4. **Input Validation** - Pydantic models validate all requests

## Environment Variables

Required:
- `GOOGLE_PLACES_API_KEY` - For autocomplete and place details
- `GOOGLE_MAPS_API_KEY` - For directions and maps display

Optional:
- `PORT` - Server port (default: 8000)
- `HOST` - Server host (default: 0.0.0.0)

## Production Deployment

1. **Secure Environment Variables**
   - Use secure secret management
   - Never commit API keys to version control

2. **Enhance Rate Limiting**
   - Consider Redis-based rate limiting
   - Implement user-based quotas

3. **CORS Security**
   - Restrict `allow_origins` to your app domains
   - Remove wildcard (`*`) origins

4. **Additional Security**
   - Add authentication/authorization
   - Implement request logging
   - Add API usage monitoring

## Example Usage

```python
# Autocomplete request
import requests

response = requests.post('http://localhost:8000/api/places/autocomplete', json={
    'input': 'San Francisco',
    'types': 'geocode'
})
```

```bash
# Health check
curl http://localhost:8000/

# Autocomplete
curl -X POST http://localhost:8000/api/places/autocomplete \
  -H "Content-Type: application/json" \
  -d '{"input": "San Francisco", "types": "geocode"}'
```
