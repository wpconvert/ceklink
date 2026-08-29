# Nawala Checker Server

Server API untuk mengecek status domain terhadap DNS filtering
Nawala / Komdigi.

## Endpoint

### Health

GET /health

### Check Domain

GET /check?domain=example.com

Contoh:

/check?domain=meta.com

## Response

Normal:

{
  "success": true,
  "domain": "example.com",
  "status": "normal",
  "blocked": false
}

Nawala:

{
  "success": true,
  "domain": "example.com",
  "status": "nawala",
  "blocked": true
}
