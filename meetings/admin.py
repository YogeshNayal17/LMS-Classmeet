from django.contrib import admin
from .models import Meeting

@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = ['title', 'course', 'created_by', 'start_time', 'duration']
    list_filter = ['course', 'created_by', 'start_time']
    search_fields = ['title', 'course__title', 'created_by__username']
    date_hierarchy = 'start_time'
    
    def duration_display(self, obj):
        return f"{obj.duration} minutes"
    duration_display.short_description = 'Duration'
