.PHONY: db-migrate db-seed

# Usage: make db-migrate NAME=add_user_table
db-migrate:
	@test -n "$(NAME)" || (echo "Usage: make db-migrate NAME=your_migration_name" && exit 1)
	docker compose exec api sh -lc 'cd /app/apps/api && pnpm exec prisma migrate dev --name "$(NAME)"'

db-seed:
	docker compose exec api sh -lc 'cd /app/apps/api && pnpm exec prisma db seed'
