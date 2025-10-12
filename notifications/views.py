from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Notification

@login_required
def mark_notification_as_read(request, notification_id):
    notification = get_object_or_404(Notification, id=notification_id, recipient=request.user)
    notification.read = True
    notification.save()

    if notification.discussion:
        return redirect('discussion_detail', discussion_id=notification.discussion.id)
    else:
        # If there's no discussion associated, redirect to a default page like the dashboard
        return redirect('dashboard')