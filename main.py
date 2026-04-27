from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()
app = FastAPI(title="RADAR Scoring API")

@app.get("/health")
def health_check():
    return {"status": "alive"}

@app.get("/")
def root():
    return {"message": "RADAR scoring service", "version": "0.1.0"}
