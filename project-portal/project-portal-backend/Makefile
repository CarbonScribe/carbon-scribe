.PHONY: build run test clean lint fmt deps

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

# Build directories
BUILD_DIR=./build
BINARY_NAME=portal-api

# Main package
MAIN_PACKAGE=./cmd/portal-api

all: deps lint test build

# Dependencies
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Build
build:
	mkdir -p $(BUILD_DIR)
	$(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PACKAGE)

build-linux:
	mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME)-linux $(MAIN_PACKAGE)

# Run
run:
	$(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME) $(MAIN_PACKAGE)
	$(BUILD_DIR)/$(BINARY_NAME)

# Test
test:
	$(GOTEST) -v ./...

test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

test-notifications:
	$(GOTEST) -v ./internal/notifications/...

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

# Database (Postgres)
db-up:
	docker-compose up -d db

db-down:
	docker-compose down

db-logs:
	docker-compose logs -f db

# Help
help:
	@echo "Available targets:"
	@echo "  all               - Run all targets"
	@echo "  deps              - Download and tidy dependencies"
	@echo "  build             - Build the API binary"
	@echo "  build-linux       - Build for Linux"
	@echo "  run               - Build and run the API"
	@echo "  test              - Run tests"
	@echo "  test-coverage     - Run tests with coverage"
	@echo "  test-notifications- Run notification module tests"
	@echo "  lint              - Run linter"
	@echo "  fmt               - Format code"
	@echo "  vet               - Run go vet"
	@echo "  clean             - Clean build artifacts"
	@echo "  db-up             - Start Postgres database"
	@echo "  db-down           - Stop Postgres database"
	@echo "  db-logs           - View database logs"
