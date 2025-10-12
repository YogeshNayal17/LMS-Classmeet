from django.contrib import admin
from .models import Discussion, Comment

class CommentInline(admin.TabularInline):
    model = Comment
    extra = 1 # Number of extra forms to display

@admin.register(Discussion)
class DiscussionAdmin(admin.ModelAdmin):
    list_display = ('title', 'author', 'created_at', 'upvote_count')
    list_filter = ('created_at', 'author')
    search_fields = ('title', 'description')
    inlines = [CommentInline]

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'author', 'created_at')
    list_filter = ('created_at', 'author')
    search_fields = ('text',)