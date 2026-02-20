FROM python:3.12-slim
WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Ensure data directory exists for SQLite
RUN mkdir -p /app/data

EXPOSE 8000

# Run database migrations then start Daphne (ASGI)
CMD ["sh", "-c", "python manage.py migrate --run-syncdb && daphne -b 0.0.0.0 -p 8000 poker_clock.asgi:application"]
