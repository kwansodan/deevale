#!/bin/sh
set -e

echo "Running database migrations..."
flask --app wsgi db upgrade

echo "Starting application server..."
exec "$@"
