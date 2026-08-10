# The stack runs entirely in containers on the server via
# docker-compose.prod.yml (deployed by Komodo). There is no separate local
# backing-services file; these targets run against whatever DATABASE_URL /
# REDIS_URL point at, e.g. inside a service container or in CI.
.PHONY: install migrate upgrade downgrade seed demo run worker beat test lint typecheck

install:
	pip install -r requirements-dev.txt

migrate:
	flask --app wsgi db migrate

upgrade:
	flask --app wsgi db upgrade

downgrade:
	flask --app wsgi db downgrade

seed:
	python -m seeds.seed_roles
	python -m seeds.seed_fee_schedule
	python -m seeds.seed_workflow_definitions

demo:
	python -m seeds.seed_demo

run:
	flask --app wsgi run --debug

worker:
	celery -A app.celery_app worker --loglevel=info --pool=solo

beat:
	celery -A celery_beat_schedule beat --loglevel=info

test:
	pytest -v

lint:
	ruff check .

typecheck:
	mypy app
