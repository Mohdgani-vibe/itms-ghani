SHELL := /bin/bash

APP_NAME := itms-server
REPO_ROOT := ..

.PHONY: run run-host build tidy compose-up compose-down smoke-test start teleport-env-check teleport-sync-dry-run teleport-ready teleport-generate-secrets teleport-login teleport-manual-steps teleport-sync teleport-status

run:
	bash ../scripts/start-itms-backend.sh

run-host:
	GOTOOLCHAIN=local go run ./cmd/server

start:
	bash ../scripts/start-itms-backend.sh

build:
	GOTOOLCHAIN=local go build -o ./bin/$(APP_NAME) ./cmd/server

tidy:
	GOTOOLCHAIN=local go mod tidy

compose-up:
	bash ../scripts/start-itms-backend.sh

compose-down:
	@if docker compose version >/dev/null 2>&1; then \
		docker compose down -v; \
	elif command -v docker-compose >/dev/null 2>&1; then \
		docker-compose down -v; \
	else \
		echo "Neither 'docker compose' nor 'docker-compose' is available." >&2; \
		exit 1; \
	fi

smoke-test:
	bash ../scripts/smoke-test-itms-api.sh

teleport-env-check:
	$(MAKE) -C $(REPO_ROOT) teleport-env-check

teleport-sync-dry-run:
	$(MAKE) -C $(REPO_ROOT) teleport-sync-dry-run

teleport-ready:
	$(MAKE) -C $(REPO_ROOT) teleport-ready

teleport-generate-secrets:
	$(MAKE) -C $(REPO_ROOT) teleport-generate-secrets

teleport-login:
	$(MAKE) -C $(REPO_ROOT) teleport-login

teleport-manual-steps:
	$(MAKE) -C $(REPO_ROOT) teleport-manual-steps

teleport-sync:
	$(MAKE) -C $(REPO_ROOT) teleport-sync

teleport-status:
	$(MAKE) -C $(REPO_ROOT) teleport-status
