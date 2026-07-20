# Load testing

`locustfile.py` drives the workflow-engine and ops-queue hot paths at the
200-concurrent-client target.

```bash
pip install locust
# Bring the stack up and seed demo data (officer account + cases).
make demo
locust -f loadtest/locustfile.py --host http://localhost:5000 \
    --users 200 --spawn-rate 20 --run-time 3m --headless
```

## N+1 queries fixed after profiling

- **`GET /cases/queue`** — the summary serializer reads each case's stages and
  tasks for the SLA countdown and current-stage columns. Without eager loading
  that's one query per case for stages and one per stage for tasks. Fixed with
  `selectinload(BusinessCase.stages).selectinload(CaseStage.tasks)` in
  `app/workflow/routes.py::case_queue_route`, collapsing a page of 15 cases from
  ~100 queries to 3.
- **`GET /cases/<id>`** — the detail serializer walks the full stage/task tree.
  `_get_case_or_404` now eager-loads the same relationships, so a case with 6
  stages is 3 queries instead of ~13.
