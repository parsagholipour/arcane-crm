.PHONY: up down migrate

up:
	docker compose up -d

down:
	docker compose down

dbmigration-up:
	npm run prisma:migrate
