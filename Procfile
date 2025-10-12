# web: daphne -b 0.0.0.0 -p $PORT lms.asgi:application
web: python manage.py runserver 0.0.0.0:$PORT
worker: celery -A lms worker -l info
beat: celery -A lms beat -l info
