import requests
import numpy as np
import tensorflow as tf
from fastapi import FastAPI
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Change "*" to frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained LSTM model
model = tf.keras.models.load_model("LSTM.keras")

# Prometheus API URL
PROMETHEUS_URL = "http://172.20.10.5:9090/api/v1/query"


# Function to fetch Prometheus metrics
def fetch_prometheus_data():
    queries = {
        "cpu_usage": '100 - avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100',
        "memory_usage": "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
    }

    metrics = {}
    for key, query in queries.items():
        response = requests.get(PROMETHEUS_URL, params={"query": query})
        if response.status_code == 200:
            try:
                metrics[key] = float(response.json()["data"]["result"][0]["value"][1])
            except (KeyError, IndexError):
                metrics[key] = None  # Handle missing data
        else:
            metrics[key] = None  # Error handling

    return metrics


# Function to normalize data (Replace min/max with actual dataset values)
def normalize(value, min_val, max_val):
    return (value - min_val) / (max_val - min_val) if max_val > min_val else 0.0


@app.get("/predict")
def predict_failure():
    metrics = fetch_prometheus_data()
    if metrics["cpu_usage"] is None or metrics["memory_usage"] is None:
        return {"error": "Could not fetch metrics from Prometheus"}

    resource_request_cpus = -0.939571 + (metrics["cpu_usage"] / 50)
    vertical_scaling = 1.0 + (metrics["memory_usage"] / 50)
    collection_id = random.uniform(3.750866e11, 8.250428e11)
    priority = 0.0
    resource_request_memory = -1.326162 + (metrics["memory_usage"] / 50)
    collection_type = 0.0  # No variation in dataset
    scheduler = random.choice([0, 1])
    assigned_memory = metrics["memory_usage"]
    cpu_usage = metrics["cpu_usage"]
    power_consumption = 87 + (cpu_usage / 100)

    # Normalize Data
    min_cpu, max_cpu = 0.000000, 1.000000
    min_memory, max_memory = 0.000000, 1.000000
    min_power, max_power = 0, 100

    X_live = np.array(
        [
            [
                collection_id,
                priority,
                resource_request_cpus,
                resource_request_memory,
                collection_type,
                vertical_scaling,
                scheduler,
                normalize(assigned_memory, min_memory, max_memory),
                normalize(cpu_usage, min_cpu, max_cpu),
                power_consumption,
            ]
        ]
    )

    # Reshape input to match LSTM model (1 sample, num_features, 1)
    X_live = np.expand_dims(X_live, axis=-1)

    # Predict failure
    prediction = model.predict(X_live)
    failure_probability = float(prediction[0][0])

    return {"failure_probability": failure_probability}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
