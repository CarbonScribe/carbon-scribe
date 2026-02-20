.PHONY: build run test clean lint fmt deps docker-build docker-run lambda-build db-up db-down db-logs db-shell test-integration

# Load environment variables from .env file
-include .env
export

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod
GOFMT=gofmt
GOLINT=golangci-lint

# Binary names
BINARY_NAME=api
LAMBDA_BINARY=bootstrap

# Build directories
BUILD_DIR=./build
LAMBDA_DIR=./build/lambda

# Main package
MAIN_PACKAGE=./cmd/api

# Docker
DOCKER_IMAGE=carbonscribe-portal-api
DOCKER_TAG=latest

all: deps lint test build


# Build
build:
	go build -tags "!future" ./...

build-linux:
	mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux $(MAIN_PACKAGE)

check:
	@echo "🔍 Checking Go project..."
	go mod tidy
	go mod download
	go build -tags "!future" ./...
	go vet ./...
	@echo "✅ Project builds successfully"

deps:
	@echo "📦 Installing Go dependencies..."
	$(GOMOD) download
	$(GOMOD) tidy
	@echo "✅ Dependencies installed successfully"

# Lambda builds
lambda-build:
	mkdir -p $(LAMBDA_DIR)
	GOOS=linux GOARCH=arm64 $(GOBUILD) -tags lambda.norpc -o $(LAMBDA_DIR)/$(LAMBDA_BINARY) ./cmd/lambda/websocket

lambda-zip: lambda-build
	cd $(LAMBDA_DIR) && zip function.zip $(LAMBDA_BINARY)

# Run
run: 
	go run cmd/api/main.go

dev:
	air -c .air.toml

# Database (Postgres)
db-up:
	docker-compose up -d db

db-down:
	docker-compose down

db-logs:
	docker-compose logs -f db

db-shell:
	docker-compose exec db psql -U user -d carbonscribe

# Test
test:
	$(GOTEST) -v ./...

test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

test-notifications:
	$(GOTEST) -v ./internal/notifications/...

test-integration: db-up
	$(GOTEST) -v -tags integration ./internal/health/...

# Lint and format
lint:
	$(GOLINT) run ./...

fmt:
	$(GOFMT) -s -w .

vet:
	$(GOCMD) vet ./...

# Clean
clean:
	$(GOCLEAN)
	rm -rf $(BUILD_DIR)
	rm -f coverage.out coverage.html

# Docker
docker-build:
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) .

docker-run:
	docker run -p 8080:8080 --env-file .env $(DOCKER_IMAGE):$(DOCKER_TAG)

docker-push:
	docker push $(DOCKER_IMAGE):$(DOCKER_TAG)

# Database migrations
migrate-up:
	migrate -path ./internal/database/migrations -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path ./internal/database/migrations -database "$(DATABASE_URL)" down

migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir ./internal/database/migrations -seq $$name

# Generate
generate:
	$(GOCMD) generate ./...

# AWS LocalStack (for local development)
localstack-start:
	docker-compose -f docker-compose.localstack.yml up -d

localstack-stop:
	docker-compose -f docker-compose.localstack.yml down

# DynamoDB tables (for local development with LocalStack)
dynamodb-create-tables:
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name NotificationTemplates \
		--attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
		--key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
		--billing-mode PAY_PER_REQUEST
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name NotificationRules \
		--attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
		--key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
		--billing-mode PAY_PER_REQUEST
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name UserPreferences \
		--attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
		--key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
		--billing-mode PAY_PER_REQUEST
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name WebSocketConnections \
		--attribute-definitions AttributeName=PK,AttributeType=S \
		--key-schema AttributeName=PK,KeyType=HASH \
		--billing-mode PAY_PER_REQUEST
	aws --endpoint-url=http://localhost:4566 dynamodb create-table \
		--table-name DeliveryLogs \
		--attribute-definitions AttributeName=PK,AttributeType=S AttributeName=SK,AttributeType=S \
		--key-schema AttributeName=PK,KeyType=HASH AttributeName=SK,KeyType=RANGE \
		--billing-mode PAY_PER_REQUEST

# Help
help:
	@echo "Available targets:"
	@echo "  deps              - Download and tidy dependencies"
	@echo "  build             - Build the API binary"
	@echo "  build-linux       - Build for Linux"
	@echo "  lambda-build      - Build Lambda function"
	@echo "  lambda-zip        - Build and zip Lambda function"
	@echo "  run               - Build and run the API"
	@echo "  dev               - Run with hot reload (requires air)"
	@echo "  test              - Run tests"
	@echo "  test-coverage     - Run tests with coverage"
	@echo "  test-notifications- Run notification module tests"
	@echo "  test-integration  - Run health integration tests"
	@echo "  lint              - Run linter"
	@echo "  fmt               - Format code"
	@echo "  clean             - Clean build artifacts"
	@echo "  db-up             - Start Postgres database"
	@echo "  db-down           - Stop Postgres database"
	@echo "  db-logs           - View database logs"
	@echo "  db-shell          - Login to database shell"
	@echo "  docker-build      - Build Docker image"
	@echo "  docker-run        - Run Docker container"
	@echo "  migrate-up        - Run database migrations"
	@echo "  migrate-down      - Rollback database migrations"
	@echo "  localstack-start  - Start LocalStack for local development"
	@echo "  dynamodb-create-tables - Create DynamoDB tables in LocalStack"
