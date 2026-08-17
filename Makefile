.PHONY: up down migrate

up:
	docker compose up -d
	@echo
	@echo "Postgres: postgresql://crm:crm@localhost:5433/crm"
	@echo "App:      http://localhost:3000"

down:
	docker compose down

dbmigration-up:
	npm run prisma:migrate
