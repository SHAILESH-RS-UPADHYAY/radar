# RADAR — Web Scraping & AI Scoring Service

Python backend that scrapes 50+ websites, runs content through an LLM scoring pipeline, and stores results in SQLite. Containerized with Docker Compose.

## What it does
- Scrapes pages with adaptive HTML parsers (handles different page structures)
- Scores content through OpenAI API across 4 weighted dimensions
- Stores scored results in SQLite with indexed timestamps
- Exposes a FastAPI endpoint for on-demand scoring
- Runs unattended via cron scheduling in Docker

## Stack
Python, FastAPI, Docker, OpenAI API, SQLite, BeautifulSoup, GitHub Actions

## Run it
\\\ash
docker-compose up -d
\\\

## Status
🚧 In active development
