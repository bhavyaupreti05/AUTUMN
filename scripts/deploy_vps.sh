#!/bin/bash
# VPS Deployment Script for ChatBot-2 (Ubuntu/Debian)
# This script sets up the environment, installs dependencies, and configures the systemd service.

set -e

echo "Starting deployment setup for ChatBot-2..."

# 1. System Updates and Dependencies
echo "Updating system and installing base dependencies..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv git curl build-essential wget nginx certbot python3-certbot-nginx

# 2. Setup Project Directory (Assuming we are in the project root)
PROJECT_DIR=$(pwd)
echo "Project directory: $PROJECT_DIR"

# 3. Virtual Environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate

# 4. Install Python Dependencies
echo "Installing requirements..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    # Fallback to manual installation if requirements.txt doesn't exist
    pip install fastapi uvicorn llama-cpp-python chromadb pymupdf pydantic pydantic_settings
fi

# 5. Create necessary directories
echo "Ensuring data directories exist..."
mkdir -p data/chroma
mkdir -p data/documents

# 6. Setup Systemd Service
echo "Configuring systemd service..."
sudo cp scripts/chatbot.service /etc/systemd/system/chatbot.service

# Adjust the paths in the service file to point to the current directory
sudo sed -i "s|/opt/chatbot-2|$PROJECT_DIR|g" /etc/systemd/system/chatbot.service
sudo sed -i "s|User=ubuntu|User=$USER|g" /etc/systemd/system/chatbot.service

sudo systemctl daemon-reload
sudo systemctl enable chatbot.service

# 7. Nginx TLS Configuration
echo "Configuring Nginx for TLS via Certbot..."
read -p "Enter your public domain name (e.g., chat.example.com) [Skip to leave HTTP only]: " DOMAIN_NAME
if [ -n "$DOMAIN_NAME" ]; then
    read -p "Enter admin email for Let's Encrypt certificate notices: " ADMIN_EMAIL
    
    NGINX_CONF="/etc/nginx/sites-available/chatbot"
    sudo bash -c "cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
EOF"
    
    sudo ln -sf /etc/nginx/sites-available/chatbot /etc/nginx/sites-enabled/chatbot
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo systemctl reload nginx

    echo "Running Certbot to secure the domain..."
    if [ -n "$ADMIN_EMAIL" ]; then
        sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect --hsts
    else
        sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --register-unsafely-without-email --agree-tos --redirect --hsts
    fi
    echo "Nginx TLS configured successfully."
else
    echo "Skipping TLS configuration. Application will run on HTTP only."
fi

echo "Deployment setup complete!"
echo "Please review your .env file, then start the service with: sudo systemctl start chatbot.service"
