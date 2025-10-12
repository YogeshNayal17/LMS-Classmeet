web: daphne -b 0.0.0.0 -p $PORT lms.asgi:application
worker: celery -A lms worker -l info
beat: celery -A lms beat -l info
