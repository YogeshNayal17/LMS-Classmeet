
from django.urls import path
from . import views

urlpatterns = [
    path('', views.discussion_list, name='discussion_list'),
    path('create/', views.create_discussion, name='create_discussion'),
    path('<int:discussion_id>/', views.discussion_detail, name='discussion_detail'),
    path('<int:discussion_id>/upvote/', views.upvote_discussion, name='upvote_discussion'),
]
