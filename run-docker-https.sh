export CERT=$(cat ./certs/cert.pem)
export KEY=$(cat ./certs/key.pem)
set -a            # Enable auto-export
source ./env       # Load the file
set +a  
docker build -t mcp-server:latest .
docker-compose up -d