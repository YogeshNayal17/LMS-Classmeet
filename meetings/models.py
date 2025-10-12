import uuid
from django.db import models
from django.contrib.auth.models import User
from classmeet.models import Course

class Meeting(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='meetings')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meetings_created')
    start_time = models.DateTimeField()
    duration = models.PositiveIntegerField(help_text='Duration in minutes', default=60)  # Default 1 hour
    room_name = models.CharField(max_length=255, unique=True, default=uuid.uuid4)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title