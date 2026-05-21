# syntax=docker/dockerfile:1

# Lambda-compatible container image.
# For local dev, docker-compose overrides CMD to run uvicorn instead.
FROM public.ecr.aws/lambda/python:3.12

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-bake the embedding model so Lambda cold starts don't download it
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('BAAI/bge-small-en-v1.5')"

COPY app/ ${LAMBDA_TASK_ROOT}/app/

CMD ["app.lambda_handler.handler"]
