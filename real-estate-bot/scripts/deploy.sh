#!/bin/bash

# Deploy script for Real Estate Bot

set -e

echo "🚀 Starting deployment..."

# Configuration
DEPLOY_USER=${DEPLOY_USER:-"deploy"}
DEPLOY_HOST=${DEPLOY_HOST:-"your-server.com"}
DEPLOY_PATH=${DEPLOY_PATH:-"/opt/real-estate-bot"}
ENV_FILE=${ENV_FILE:-".env.production"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Check if environment file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file $ENV_FILE not found!"
    exit 1
fi

# Build Docker images locally
log_info "Building Docker images..."
docker-compose build

# Tag images for deployment
log_info "Tagging images..."
docker tag real-estate-bot_bot:latest $DEPLOY_HOST:5000/real-estate-bot_bot:latest
docker tag real-estate-bot_api:latest $DEPLOY_HOST:5000/real-estate-bot_api:latest
docker tag real-estate-bot_mini-app:latest $DEPLOY_HOST:5000/real-estate-bot_mini-app:latest

# Push images to registry
log_info "Pushing images to registry..."
docker push $DEPLOY_HOST:5000/real-estate-bot_bot:latest
docker push $DEPLOY_HOST:5000/real-estate-bot_api:latest
docker push $DEPLOY_HOST:5000/real-estate-bot_mini-app:latest

# Deploy to server
log_info "Deploying to server..."
ssh $DEPLOY_USER@$DEPLOY_HOST << 'ENDSSH'
    cd $DEPLOY_PATH
    
    # Backup current environment
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    
    # Pull latest code
    git pull origin main
    
    # Update Docker images
    docker-compose pull
    
    # Run database migrations
    docker-compose run --rm bot npm run db:migrate --workspace=@real-estate-bot/database
    
    # Restart services with zero downtime
    docker-compose up -d --no-deps --scale bot=2 bot
    sleep 10
    docker-compose up -d --no-deps bot
    
    docker-compose up -d --no-deps --scale api=2 api
    sleep 10
    docker-compose up -d --no-deps api
    
    docker-compose up -d --no-deps mini-app
    
    # Clean up old images
    docker image prune -f
    
    # Health check
    sleep 5
    docker-compose ps
ENDSSH

# Verify deployment
log_info "Verifying deployment..."
curl -f -s -o /dev/null https://$DEPLOY_HOST/health || {
    log_error "Health check failed!"
    exit 1
}

log_success "Deployment completed successfully!"

# Send notification (optional)
if [ ! -z "$SLACK_WEBHOOK" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"✅ Real Estate Bot deployed successfully!"}' \
        $SLACK_WEBHOOK
fi