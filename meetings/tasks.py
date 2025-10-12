
from celery import shared_task
from django.contrib.auth.models import User
from notifications.models import Notification
from .models import Meeting

@shared_task
def send_meeting_notification(meeting_id):
    try:
        meeting = Meeting.objects.get(id=meeting_id)
    except Meeting.DoesNotExist:
        return

    # Notify the teacher who created the meeting
    Notification.objects.create(
        recipient=meeting.created_by,
        sender=meeting.created_by, # Or a system user if you have one
        message=f'Your meeting "{meeting.title}" is starting now.',
        discussion=None # Or link to the meeting room
    )

    # Notify all students (assuming non-teachers are students)
    students = User.objects.exclude(groups__name='Teacher')
    for student in students:
        Notification.objects.create(
            recipient=student,
            sender=meeting.created_by,
            message=f'The meeting "{meeting.title}" for your course is starting now.',
            discussion=None # Or link to the meeting room
        )
