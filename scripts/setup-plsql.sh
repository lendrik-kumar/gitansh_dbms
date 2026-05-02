#!/bin/bash

# Smart Society - PL/SQL Setup Script
# This script sets up stored procedures in MySQL

set -e

DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASSWORD="root"
DB_NAME="smart_society"

echo "=== Smart Society - Stored Procedures Setup ==="
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Starting Docker..."
    # Try to start docker daemon
    sudo systemctl start docker 2>/dev/null || true
    sleep 2
fi

# Check if MySQL container is already running
if docker ps --format '{{.Names}}' | grep -q "smart_society_db"; then
    echo "✅ MySQL container already running"
else
    echo "🔄 Starting MySQL container..."
    cd /home/vishwas/gitansh_dbms
    docker-compose up -d
    echo "⏳ Waiting for MySQL to be ready..."
    sleep 10
fi

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
for i in {1..30}; do
    if docker exec smart_society_db mysqladmin ping -h localhost -uroot -proot > /dev/null 2>&1; then
        echo "✅ MySQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ MySQL failed to start"
        exit 1
    fi
    sleep 1
done

# Run stored procedures
echo "📝 Creating stored procedures..."
docker exec -i smart_society_db mysql -uroot -proot < /home/vishwas/gitansh_dbms/backend/sql/stored-procedures.sql

echo ""
echo "✅ Stored procedures created successfully!"
echo ""

# List stored procedures
echo "📋 Stored procedures in database:"
docker exec smart_society_db mysql -uroot -proot -e "SHOW PROCEDURE STATUS WHERE Db = '$DB_NAME';" 2>/dev/null | grep -v "Warning" | awk '{print $4}' | tail -n +2

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To test stored procedures, run:"
echo "  bash scripts/test-stored-procedures.sh"
echo ""
echo "Or use the SQL Runner in the web interface:"