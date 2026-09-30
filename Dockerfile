FROM python:3.12-slim

# WeasyPrint native dependencies (Pango/Cairo) for receipt PDF generation.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 \
    libffi8 shared-mime-info fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations
COPY seeds ./seeds
COPY wsgi.py entrypoint.sh ./
RUN chmod +x entrypoint.sh && sed -i 's/\r$//' entrypoint.sh

ENV FLASK_ENV=production
EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--threads", "2", "wsgi:app"]
