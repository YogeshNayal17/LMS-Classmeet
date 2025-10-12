from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from classmeet.views import teacher_required
from classmeet.models import Course
from .models import Meeting
from .forms import MeetingForm
from .tasks import send_meeting_notification

@login_required
@teacher_required
def schedule_meeting(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    if request.method == 'POST':
        form = MeetingForm(request.POST)
        if form.is_valid():
            meeting = form.save(commit=False)
            meeting.course = course
            meeting.created_by = request.user
            meeting.save()

            # Schedule the notification task
            send_meeting_notification.apply_async(
                (meeting.id,),
                eta=meeting.start_time
            )

            return redirect('course_detail', course_id=course.id)
    else:
        form = MeetingForm()
    return render(request, 'meetings/schedule_meeting.html', {'form': form, 'course': course})

@login_required
def meeting_room(request, meeting_id):
    meeting = get_object_or_404(Meeting, id=meeting_id)
    # Ensure only enrolled students or teacher can join
    
    if not request.user.groups.filter(name='Student').exists() and not (request.user == meeting.course.teacher):
        return redirect('meeting_list')
    return render(request, 'meetings/meeting_room.html', {
        'meeting': meeting,
        'user_name': request.user.first_name or request.user.username
    })

@login_required
def meeting_list(request):
    current_time = timezone.now()
    # Get the user's courses
    if request.user.groups.filter(name='Teacher').exists():
        courses = Course.objects.filter(teacher=request.user)
    else:
        # For students, get courses they're enrolled in
        courses = Course.objects.all()

    # Get meetings for these courses
    upcoming_meetings = Meeting.objects.filter(
        course__in=courses,
        start_time__gte=current_time
    ).order_by('start_time')
    
    past_meetings = Meeting.objects.filter(
        course__in=courses,
        start_time__lt=current_time
    ).order_by('-start_time')

    return render(request, 'meetings/meeting_list.html', {
        'upcoming_meetings': upcoming_meetings,
        'past_meetings': past_meetings,
        'is_teacher': request.user.groups.filter(name='Teacher').exists(),
        'courses': courses  # Pass courses to template for the schedule meeting dropdown
    })