FROM python:3.11-slim

WORKDIR /app

# Install system dependencies (needed for compiling Python packages and DB connections)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code (files specified in .dockerignore will be skipped)
COPY . .

EXPOSE 8000

# Start server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
