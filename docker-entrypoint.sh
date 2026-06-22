#!/bin/sh
set -e

echo "Running database migrations..."
npm run migrate

echo "Starting application..."
exec node dist/server.js
