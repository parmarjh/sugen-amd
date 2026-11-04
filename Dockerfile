FROM python:3.11-slim

WORKDIR /workspace

# Copy MMS ontology, scorer, and coder pipeline into the container image ahead of time
COPY data/ ./data/
COPY score.py ./score.py
COPY coder.py ./coder.py

RUN chmod +x /workspace/coder.py

ENTRYPOINT ["python3", "/workspace/coder.py"]
