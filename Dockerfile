# GeoTrace-AI Production Docker Container
# Module 30: Reproducibility and Deployment

FROM python:3.14-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL environment variables
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

# Copy Python requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./backend/

# Copy frontend files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY src/ ./src/
COPY index.html ./

# Install Node.js and frontend dependencies
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install && \
    npm run build

# Expose port
EXPOSE 3000

# Set environment variables
ENV PYTHONPATH=/app/backend
ENV DATABASE_URL="file:./backend/dev.db"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:3000/api/health')"

# Run the application
CMD ["python", "backend/app/main.py"]