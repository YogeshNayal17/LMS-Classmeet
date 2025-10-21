# Classmeet (LMS) — README

🚀 **Live Demo:** [https://lms-classmeet.onrender.com](https://lms-classmeet.onrender.com)

-
 Media storage placeholders under 
`
media/
`
 for course materials and thumbnails.
##
 Useful packages & recommendations
Core runtime:
-
 Django (main web framework)
-
 Channels (WebSocket + ASGI support)
-
 channels-redis (Redis channel layer)
-
 daphne (ASGI server for production-like testing)
-
 Redis (channel layer backend)
WebRTC helpers and media:
-
 No extra server-side libraries needed for WebRTC signaling
-
 Use coturn (TURN server) for reliable media relay in NAT/firewall situations
Background tasks & async:
-
 Celery + Redis or RabbitMQ (for scheduled notifications)
Authentication & API:
-
 djangorestframework (if you add REST endpoints later)
-
 django-allauth (optional, for social auth)
Security & Production:
-
 django-environ (for environment config)
-
 whitenoise (serve static files if not using separate static server)
-
 django-axes or django-ratelimit (brute force protection)
-
 Sentry SDK (error monitoring)
Dev tools:
-
 pytest + pytest-django (testing)
-
 pre-commit (lint hooks)
-
 eslint + prettier (JS lint/format)
##
 Developer Notes & Troubleshooting
Common issues and tips:
-
 WebSocket "No handler for message type" errors usually mean Channels group message 
`
type
`
 didn't map to a handler method name (hyphens vs underscores). The consumer uses 
`
message_type.replace('-', '_')
`
 to map this.
-
 If clients don't see other participants:
  
-
 Check browser console for signaling exchanges (offers/answers/candidates)
  
-
 Confirm WebSocket messages are being sent and received by the server
  
-
 Ensure STUN/TURN servers are reachable. Without a TURN server, P2P may fail across restrictive NATs.
-
 If using 
`
runserver
`
 you may still need 
`
daphne
`
 to emulate production ASGI behavior.
Logging and debugging:
-
 Open browser devtools → Console and Network (WS) to trace signaling
-
 Check Django/Channels logs for group_send events
-
 Use 
`
docker-compose
`
 with Redis and optional coturn for consistent local testing
---
If you want, I can also:
-
 Add a 
`
requirements.txt
`
 that pins current packages for this repo
-
 Add a simple 
`
docker-compose.yml
`
 with Django, Redis, and coturn for local testing
-
 Add basic tests for the signaling consumer
Next I'll mark the README task as completed in the todo list and update the second item to completed as well.
