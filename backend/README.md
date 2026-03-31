# 🚀 Backend — Clean Street Civic App

## 📌 Overview

This is the **backend** of the *Clean Street Civic Issue Reporting Application*.
It is built using **Node.js & Express** and follows a clean **MVC architecture** for scalability and maintainability.

---

## ✨ Features

* 🔐 User Authentication (Login / Register)
* 📝 Issue Reporting System
* 🛠️ Admin Management (Users & Reports)
* 🔗 RESTful API Endpoints
* ⚙️ Middleware (Authentication & Error Handling)

---

## 🧱 Tech Stack

* ⚙️ Node.js
* 🚀 Express.js
* 🗄️ MongoDB (Mongoose)
* 🔑 JWT Authentication

---

## 📂 Folder Structure

```bash
config/        → Database configuration  
controllers/   → Business logic  
middleware/    → Authentication & error handling  
models/        → Database schemas  
routes/        → API endpoints  
utils/         → Helper functions  
```

---

## ⚙️ Getting Started

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Run Server

```bash
node server.js
```

---

## 🔐 Environment Variables

Create a `.env` file in the root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_secret_key
```

---

## 🎯 Purpose

To build a **robust and scalable backend system** for managing civic issues efficiently.
