# Timetable Generator API

![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.8+-3776AB.svg?logo=python)

A powerful, high-performance web application and API for generating optimized university or school timetables. The application uses intelligent constraint solving to prevent conflicts and respect preferences like free days, avoiding early mornings, or avoiding late evenings.

## Why I did this?
My college follows a "Flexi-Learn" system where students manually enroll in their desired subjects each semester. During the enrollment window, students often struggle to draft their timetables within a tight 2-hour time constraint. I built this tool to automate and simplify that process, allowing students to generate optimal schedules instantly. While primarily designed for my institution, the logic is highly adaptable and can be implemented at other colleges with similar systems, such as Vellore Institute of Technology (VIT) or Rajalakshmi Engineering College (REC).

## How did it solve?
The application was successfully deployed and used by over 650 students. It received highly positive feedback, particularly for its ability to help students secure Saturdays off. This significantly reduced academic stress and improved the overall enrollment experience for the student body.

## Features

* **Smart Timetable Generation**: Automatically generates conflict-free schedules based on selected courses.
* **Constraint Handling**: Supports various user constraints:
  * Maximum classes per day
  * Free day preferences
  * No Saturday classes
  * No morning classes (before 10:00 AM)
  * No evening classes (after 3:00 PM)
* **High Performance**: Utilizes Python's `ProcessPoolExecutor` for parallel processing of timetable combinations, making it highly scalable and responsive even under heavy load.
* **Caching Mechanisms**: Built-in caching for course data and file monitoring to reduce unnecessary parsing.
* **REST API**: Built with FastAPI, offering a clean, documented, and fully interactive API.
* **Rate Limiting & Monitoring**: In-memory rate limiting to prevent abuse, along with detailed logging for system administrators.

## Tech Stack

* **Backend**: Python 3.8+, FastAPI, Uvicorn
* **Frontend**: HTML, CSS, JavaScript (Vanilla)
* **Concurrency**: Asyncio, Multiprocessing, Threading
* **Environment Management**: python-dotenv

## Getting Started

### Prerequisites

Ensure you have Python 3.8 or higher installed on your system.

### Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd timetable
   ```

2. **Create a virtual environment** (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   Create a `.env` file in the root directory (or modify the existing one). See the Configuration section below.

### Running the Application

You can start the server using Uvicorn:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Once running, you can access the application at:
* **Frontend UI**: `http://localhost:8000/`
* **API Documentation (Swagger UI)**: `http://localhost:8000/docs`
* **API Documentation (ReDoc)**: `http://localhost:8000/redoc`

## Configuration

The application can be configured via environment variables. Add these to your `.env` file:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `OUTPUT_FILE` | Path to the file containing course and timetable data. | `output.txt` |
| `TIMETABLE_TIMEOUT` | Maximum time (in seconds) allowed for timetable generation. | `30` |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins. | `*` |
| `RATE_LIMIT_REQUESTS` | Number of requests allowed per rate limit window. | `10` |
| `RATE_LIMIT_WINDOW` | Time window (in seconds) for rate limiting. | `60` |
| `LOG_LEVEL` | Application logging level (INFO, DEBUG, WARNING, etc.). | `INFO` |
| `LOG_DIR` | Directory where log files will be stored. | `.` |
| `SUPABASE_URL` | (Optional) Supabase URL for authentication/database. | |
| `SUPABASE_PUBLISHABLE_KEY` | (Optional) Supabase Key. | |

## Project Structure

* `main.py`: The core FastAPI application, API endpoints, constraint solving algorithms, and business logic.
* `front.html` / `login.html`: Frontend user interfaces for login and timetable generation.
* `logout.js`: Scripts handling user session termination.
* `output.txt`: The data source file containing course schedules, sections, and faculty details.
* `requirements.txt`: Python dependency list.
* `Dockerfile`: Instructions for containerizing the application using Docker.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Snaps of website

<img width="3234" height="848" alt="image" src="https://github.com/user-attachments/assets/dac362f0-8d61-4017-8f56-b45c0c6f54e4" />

