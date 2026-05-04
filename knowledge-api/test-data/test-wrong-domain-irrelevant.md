# Advanced Kubernetes Networking with Cilium eBPF

## Overview
This document covers the implementation of Cilium as a CNI (Container Network Interface) plugin for Kubernetes clusters, replacing kube-proxy with eBPF-based networking for improved performance and observability.

## Architecture
Cilium operates at Linux kernel level using eBPF (extended Berkeley Packet Filter) programs that are attached to network hooks. This enables:

### Data Plane
- **Socket-level load balancing**: Bypasses iptables entirely, connecting client sockets directly to backend pods
- **Host-routing optimization**: Eliminates per-packet overhead of traditional Linux routing stack
- **eBPF-based NAT**: Hardware-offloadable network address translation

### Control Plane
- **CiliumNetworkPolicy**: Extends Kubernetes NetworkPolicy with L7 (HTTP, gRPC, Kafka) filtering
- **ClusterMesh**: Multi-cluster connectivity with global service discovery
- **Hubble**: Network observability platform built on eBPF

## Installation
```bash
helm repo add cilium https://helm.cilium.io/
helm install cilium cilium/cilium --version 1.15.0 \
  --namespace kube-system \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=${API_SERVER_IP} \
  --set k8sServicePort=6443 \
  --set hubble.enabled=true \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true
```

## Performance Benchmarks
| Metric | kube-proxy (iptables) | Cilium eBPF |
|--------|----------------------|-------------|
| Service latency (p99) | 1.2ms | 0.3ms |
| Throughput (Gbps) | 18.5 | 38.2 |
| Connection rate (conn/s) | 45,000 | 125,000 |
| Memory per node | 210MB | 85MB |
| CPU per node (idle) | 3.2% | 0.8% |

## WireGuard Encryption
Cilium supports transparent WireGuard encryption between nodes:
```yaml
apiVersion: cilium.io/v2
kind: CiliumClusterWideNetworkPolicy
metadata:
  name: encrypt-all
spec:
  nodeSelector: {}
  encryption:
    type: wireguard
```

## This document is completely irrelevant to pharmacy operations and should be flagged by the pipeline's domain relevance filtering.

## Document Control
- **Version**: 2.0
- **Domain**: DevOps / Infrastructure
- **Relevance to Pharmacy**: NONE — This is a pipeline domain-relevance test
