SHELL := /bin/bash

.PHONY: start start-detached stop restart status smoke-test installer-smoke-test nginx-deploy-dry-run nginx-deploy nginx-smoke-test nginx-rollout teleport-env-check teleport-sync-dry-run teleport-ready teleport-generate-secrets teleport-login teleport-manual-steps teleport-sync teleport-status

start:
	bash scripts/start-itms.sh

start-detached:
	FRONTEND_BACKGROUND=1 bash scripts/start-itms.sh

stop:
	bash scripts/stop-itms.sh

restart: stop start

status:
	@printf 'Frontend: '
	@curl -I -sS http://localhost:4175 >/dev/null && echo up || echo down
	@printf 'Backend: '
	@curl -fsS http://localhost:3001/api/health >/dev/null && echo up || echo down

smoke-test:
	bash scripts/smoke-test-itms-api.sh

installer-smoke-test:
	bash scripts/smoke-test-itms-installer.sh

nginx-deploy-dry-run:
	bash scripts/install-itms-nginx.sh --dry-run YOUR_SERVER_IP

nginx-deploy:
	bash scripts/install-itms-nginx.sh YOUR_SERVER_IP

nginx-smoke-test:
	bash scripts/smoke-test-itms-nginx.sh --base-url http://YOUR_SERVER_IP

nginx-rollout: nginx-deploy-dry-run nginx-deploy nginx-smoke-test

teleport-env-check:
	bash deploy/teleport/scripts/check-local-preflight.sh

teleport-sync-dry-run:
	bash deploy/teleport/scripts/sync-salt-config.sh --dry-run --restart-salt-api --check-salt-api

teleport-ready: teleport-env-check teleport-sync-dry-run

teleport-generate-secrets:
	bash deploy/teleport/scripts/generate-env-secrets.sh

teleport-login:
	bash deploy/teleport/scripts/teleport-login.sh

teleport-manual-steps:
	bash deploy/teleport/scripts/show-manual-steps.sh

teleport-sync:
	bash deploy/teleport/scripts/sync-salt-config.sh --restart-salt-api --check-salt-api

teleport-status:
	bash deploy/teleport/scripts/show-status.sh