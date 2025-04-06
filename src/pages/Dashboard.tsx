import React, { useState, useEffect } from "react";
import { Card, CardContent, Typography } from "@mui/material";
import axios from "axios";
import { notification } from "antd";

const Dashboard = () => {
  const [cpuUsage, setCpuUsage] = useState<string | null>(null);
  const [memoryUsage, setMemoryUsage] = useState<string | null>(null);
  const [networkUsage, setNetworkUsage] = useState<string | null>(null);
  const [failureProbability, setFailureProbability] = useState<string | null>("Loading...");

  const prometheusApi = "http://172.20.10.5:9090/api/v1/query";
  const predictionApi = "http://localhost:8000/predict"; // FastAPI endpoint

  const FAILURE_THRESHOLD = 0.7; // Failure alert threshold

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const cpuResponse = await axios.get(prometheusApi, {
          params: { query: '100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)' },
        });
        setCpuUsage(cpuResponse.data.data.result[0]?.value[1] || "N/A");

        const memResponse = await axios.get(prometheusApi, {
          params: { query: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100' },
        });
        setMemoryUsage(memResponse.data.data.result[0]?.value[1] || "N/A");

        const netResponse = await axios.get(prometheusApi, {
          params: { query: 'rate(node_network_transmit_bytes_total[1m]) + rate(node_network_receive_bytes_total[1m])' },
        });
        setNetworkUsage(netResponse.data.data.result[0]?.value[1] || "N/A");
      } catch (error) {
        console.error("Error fetching metrics:", error);
        setCpuUsage("Error");
        setMemoryUsage("Error");
        setNetworkUsage("Error");
      }
    };

    const fetchFailurePrediction = async () => {
      try {
        const response = await axios.get(predictionApi);
        const failureProb = response.data.failure_probability;
        setFailureProbability(`${(failureProb * 100).toFixed(2)} %`);

        if (failureProb > FAILURE_THRESHOLD) {
          notification.error({
            message: "⚠️ WARNING: Possible Failure Detected!",
            description: `Failure Probability: ${(failureProb * 100).toFixed(2)}%.\n
            CPU Usage: ${cpuUsage}% | Memory Usage: ${memoryUsage}% | Network: ${networkUsage} bytes/sec`,
            duration: 5,
          });
        }
      } catch (error) {
        console.error("Error fetching prediction:", error);
        setFailureProbability("Error");
      }
    };

    const interval = setInterval(() => {
      fetchMetrics();
      fetchFailurePrediction();
    }, 5000);

    return () => clearInterval(interval);
  }, [cpuUsage, memoryUsage, networkUsage]);

  return (
    <div style={{ padding: "20px" }}>
      <Typography variant="h4" gutterBottom>
        Cloud Monitoring Dashboard
      </Typography>

      <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">CPU Usage</Typography>
            <Typography variant="body1">{cpuUsage !== null ? `${cpuUsage} %` : "Loading..."}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6">Memory Usage</Typography>
            <Typography variant="body1">{memoryUsage !== null ? `${memoryUsage} %` : "Loading..."}</Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1 }}>
          <CardContent> 
            <Typography variant="h6">Network Usage</Typography>
            <Typography variant="body1">{networkUsage !== null ? `${networkUsage} bytes/sec` : "Loading..."}</Typography>
          </CardContent>
        </Card>
      </div>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Failure Probability</Typography>
          <Typography variant="body1">{failureProbability !== null ? failureProbability : "Loading..."}</Typography>
        </CardContent>
      </Card>

      <Card sx={{ width: "100%", height: "100%" }}>
        <iframe
          src="http://172.20.10.5:3000/d/aei2l1afsq134d/dash1?orgId=1&from=2025-04-06T07:12:53.006Z&to=2025-04-06T07:17:53.006Z&timezone=browser"
          width="100%"
          height="900vh"
          frameBorder="0"
          allowFullScreen
        />
      </Card>
    </div>
  );
};

export default Dashboard;
