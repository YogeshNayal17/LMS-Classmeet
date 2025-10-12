
from django.urls import path
from . import views

urlpatterns = [
    path('', views.meeting_list, name='meeting_list'),
    path('schedule/<int:course_id>/', views.schedule_meeting, name='schedule_meeting'),
    path('room/<int:meeting_id>/', views.meeting_room, name='meeting_room'),
]
