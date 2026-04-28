# Project Portal: Developer Onboarding & Monitoring Suite

![Go Backend](https://img.shields.io/badge/Go-1.21-blue)
![Next.js 15](https://img.shields.io/badge/Next.js-15-black)
![Stellar Mainnet](https://img.shields.io/badge/Stellar-Mainnet-red)
![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-green)

The **Project Portal** is CarbonScribe’s interface for project developers to onboard, monitor, and tokenize regenerative agriculture and forestry projects. It connects field data, satellite verification, and blockchain tokenization in a seamless workflow.

---

## 📚 Table of Contents
- [Overview](#-overview)
- [Architecture](#-architecture)
- [Key Features](#key-features)
- [Folder Structure](#folder-structure)
- [Quick Start](#quick-start)
- [Security](#security)
- [Contributing](#contributing)

---

## 🌱 Overview
The Project Portal enables:
- **Project onboarding** with AI-assisted PDD generation
- **Real-time monitoring** using satellite and IoT data
- **Tokenization** of verified removals as Stellar Assets
- **Forward sale marketplace** for project financing

## 🏗️ Architecture
```
project-portal/
├── project-portal-backend/   # Go backend for orchestration & tokenization
├── project-portal-web/       # Next.js 15 frontend for onboarding & dashboards
```
- **Backend:** Handles project intake, verification, and asset minting
- **Frontend:** Developer portal for onboarding, monitoring, and analytics

## 🚀 Key Features
- Interactive project mapping & NDVI timelines
- Automated document generation & IPFS anchoring
- Forward sale and financing tools
- Real-time alerting and dashboards
- Secure, role-based access

## 📁 Folder Structure
```
project-portal/
├── project-portal-backend/   # Backend API (Go)
├── project-portal-web/       # Frontend (Next.js)
```

## ⚡ Quick Start
See individual backend and frontend READMEs for setup instructions.

## 🔒 Security
- Role-based authentication
- Immutable audit logs
- On-chain verification

## 🤝 Contributing
Pull requests welcome! See root CONTRIBUTING.md for guidelines.

---

*Part of the CarbonScribe 7-Layer Architecture. See root README for full platform overview.*
