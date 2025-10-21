# Classmeet (LMS) — README

This repository is a small Learning Management System (LMS) customized for synchronous meetings (video conferencing) using Django, Django Channels, and WebRTC. The README documents how to run the app locally, explains the architecture and signaling flow, lists all HTTP and WebSocket endpoints, highlights important features, and suggests useful packages for extending and hardening the system.

🚀 **Live Demo:** [https://lms-classmeet.onrender.com](https://lms-classmeet.onrender.com/classmeet/dashboard)

## Table of Contents

- Quick start (Windows)
- Architecture & flow
- Endpoints (HTTP & WebSocket)
- Key features
- Useful packages and why
- Development notes & troubleshooting


## Quick start (Windows)

Prerequisites
- Python 3.11+ (recommended)
- Virtualenv or venv
- Node.js & npm (optional, for building front-end assets)
- Redis (recommended) for Channels channel layer

1. Create and activate virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install Python dependencies

```powershell
pip install -r requirements.txt
# If requirements.txt doesn't exist, at minimum install:
pip install Django channels channels-redis djangorestframework
```

3. Configure environment
- Copy `.env.example` to `.env` (if present) and update: SECRET_KEY, DEBUG, DATABASE_URL, REDIS_URL, ALLOWED_HOSTS

4. Apply migrations and create a superuser

```powershell
python manage.py migrate
python manage.py createsuperuser
```

5. Run Redis (locally or in docker). Example (PowerShell with Docker):

```powershell
docker run -p 6379:6379 -d redis
```

6. Run the development server (ASGI with Channels). For local development you can use Daphne or `runserver`.

Using Django's runserver (Channels integrates automatically in `asgi.py`):

```powershell
python manage.py runserver
```

Or using Daphne (recommended for real ASGI behavior):

```powershell
pip install daphne
daphne -b 0.0.0.0 -p 8000 lms.asgi:application
```

7. Open the site
- Visit http://127.0.0.1:8000/meetings/ to view meeting list
- Create or schedule a meeting (teacher role required)
- Join meeting room: http://127.0.0.1:8000/meetings/room/<meeting_id>/


## LMS Outputs

### Authentication
This is the main authentication page.
![Authentication](LMS%20Outputs/authentication.png)

### Sign In
Users can sign in using their credentials.
![Sign In](LMS%20Outputs/signin.png)

### Sign Up
New users can create an account.
![Sign Up](LMS%20Outputs/signup.png)

### Course List
This page displays a list of all available courses.
![Course List](LMS%20Outputs/courselist.png)

### Create Course
Teachers can create new courses from this page.
![Create Course](LMS%20Outputs/course.png)

### Course Detail
This shows a detailed view of a single course, including materials and discussions.
![Course Detail](LMS%20Outputs/coursedetail.png)

### Course Material
This section shows the materials uploaded for a course.
![Course Material](LMS%20Outputs/material.png)

### Discussions (Student View)
Students can view and participate in discussions.
![Discussions (Student)](LMS%20Outputs/discussionS.png)

### Discussions (Teacher View)
Teachers can manage discussions.
![Discussions (Teacher)](LMS%20Outputs/discussionT.png)

### New Discussion (Student View)
Students can start new discussion threads.
![New Discussion (Student)](LMS%20Outputs/newdiscussionS.png)

### Discussion Notification (Teacher View)
Teachers receive notifications for new discussions or replies.
![Discussion Notification](LMS%20Outputs/discussionnotificationT.png)

### Meeting List (Student View)
Students can see a list of scheduled meetings for their courses.
![Meeting List (Student)](LMS%20Outputs/meetinglistS.png)

### Meeting List (Teacher View)
Teachers can see and manage scheduled meetings.
![Meeting List (Teacher)](LMS%20Outputs/meetinglistT.png)

### Meeting Room
The virtual meeting room where video conferencing takes place.
![Meeting Room](LMS%20Outputs/meeting.png)

## Architecture & Flow

High level components:
- Django web application (HTTP views, templates)
- Django Channels (ASGI, WebSocket signaling)
- WebRTC (peer-to-peer media)
- Redis (channel layer for scaling Channels)
- Optional Celery for background tasks (notifications)

Flow (user joins and establishes a WebRTC peer connection):
1. User authenticates via `/auth/signin/` or `/auth/signup/`.
2. User navigates to `/meetings/` and clicks a meeting room link.
3. Browser loads `meetings/meeting_room.html` which includes front-end JS (`meeting-room.js`) that:
   - Captures local media via `getUserMedia`.
   - Opens a WebSocket to `/ws/meeting/<meeting_id>/`.
   - On WebSocket open, sends a `join` message with `userId` and `userName`.
4. Server-side `MeetingConsumer` (Channels AsyncWebsocketConsumer):
   - Adds the connection to a group named `meeting_<meeting_id>`.
   - Receives `join` and broadcasts `user-joined` messages to the group.
   - Receives WebRTC signaling messages (`offer`, `answer`, `ice-candidate`) and forwards them to other participants in the room.
5. Each client responds to `user-joined` by creating an RTCPeerConnection and generating an offer.
6. Signaling messages (`offer` → `answer` → `ice-candidate` exchange) pass over the WebSocket group channel. The consumer translates hyphenated types to handler method names for Channels.
7. Once ICE negotiation succeeds and peers exchange candidates, direct P2P media flows between browsers.
8. When users disconnect, `disconnect` triggers a `user-left` broadcast and clients remove peers and video elements.

Notes:
- Signaling is performed by WebSocket only; no media goes through the Django server except for possible TURN relays.
- CSRF is not directly involved in WebSocket flows but standard Django auth is used for HTTP views.


## Endpoints (HTTP & WebSocket)

HTTP endpoints (from `lms/urls.py` inclusion):

- Admin
  - `GET /admin/` — Django admin UI

- Authentication (`authentication/urls.py`)
  - `GET/POST /auth/signup/` — Sign up view
  - `GET/POST /auth/signin/` — Sign in view
  - `GET /auth/logout/` — Logout (uses Django's LogoutView)

- Class/Course (`classmeet/urls.py`) — course management and dashboard
  - Routes under `/classmeet/` (see `classmeet` app for exact paths)

- Discussions (`discussions/urls.py`) — discussion threads
  - Routes under `/discussions/`

- Notifications (`notifications/urls.py`) — user notifications
  - Routes under `/notifications/`

- Meetings (`meetings/urls.py`)
  - `GET /meetings/` — `meeting_list` view (list upcoming & past meetings)
  - `GET/POST /meetings/schedule/<course_id>/` — `schedule_meeting` view (teachers)
  - `GET /meetings/room/<meeting_id>/` — `meeting_room` view (join meeting)

WebSocket endpoints (Channels routing — see `meetings/routing.py` and `lms/asgi.py`):
- `ws://<host>/ws/meeting/<meeting_id>/` — WebSocket used for WebRTC signaling
  - Message types used by protocol (JSON):
    - `join` — client sends on open. Server broadcasts `user-joined`.
    - `user-joined` — server -> clients: indicates a new participant
    - `offer` — client -> group: SDP offer (consumer forwards to others)
    - `answer` — client -> group: SDP answer (consumer forwards to others)
    - `ice-candidate` — client -> group: ICE candidate object
    - `user-left` — server -> clients: participant disconnected


## Important Features

- Role-aware meeting scheduling: only teachers can schedule meetings; students can join if enrolled.
- Real-time signaling via Django Channels and WebSocket.
- Peer-to-peer video/audio via WebRTC with STUN servers configured.
- Background task scheduling for meeting notifications (Celery tasks used in `meetings/tasks.py`).
- Simple, responsive UI templates using Bootstrap (templates in `meetings/templates/meetings/`).
- Media storage placeholders under `media/` for course materials and thumbnails.


## Useful packages & recommendations

Core runtime:
- Django (main web framework)
- Channels (WebSocket + ASGI support)
- channels-redis (Redis channel layer)
- daphne (ASGI server for production-like testing)
- Redis (channel layer backend)

WebRTC helpers and media:
- No extra server-side libraries needed for WebRTC signaling
- Use coturn (TURN server) for reliable media relay in NAT/firewall situations

Background tasks & async:
- Celery + Redis or RabbitMQ (for scheduled notifications)

Authentication & API:
- djangorestframework (if you add REST endpoints later)
- django-allauth (optional, for social auth)

Security & Production:
- django-environ (for environment config)
- whitenoise (serve static files if not using separate static server)
- django-axes or django-ratelimit (brute force protection)
- Sentry SDK (error monitoring)

Dev tools:
- pytest + pytest-django (testing)
- pre-commit (lint hooks)
- eslint + prettier (JS lint/format)


## Developer Notes & Troubleshooting

Common issues and tips:
- WebSocket "No handler for message type" errors usually mean Channels group message `type` didn't map to a handler method name (hyphens vs underscores). The consumer uses `message_type.replace('-', '_')` to map this.
- If clients don't see other participants:
  - Check browser console for signaling exchanges (offers/answers/candidates)
  - Confirm WebSocket messages are being sent and received by the server
  - Ensure STUN/TURN servers are reachable. Without a TURN server, P2P may fail across restrictive NATs.
- If using `runserver` you may still need `daphne` to emulate production ASGI behavior.

Logging and debugging:
- Open browser devtools → Console and Network (WS) to trace signaling
- Check Django/Channels logs for group_send events
- Use `docker-compose` with Redis and optional coturn for consistent local testing


---

If you want, I can also:
- Add a `requirements.txt` that pins current packages for this repo
- Add a simple `docker-compose.yml` with Django, Redis, and coturn for local testing
- Add basic tests for the signaling consumer

Next I'll mark the README task as completed in the todo list and update the second item to completed as well.
