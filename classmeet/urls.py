from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard, name='dashboard'),
    path('create/', views.create_course, name='create_course'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),
    path('course/<int:course_id>/add_material/', views.add_course_material, name='add_course_material'),
    path('course/<int:course_id>/delete/', views.delete_course, name='delete_course'),
    path('material/<int:material_id>/delete/', views.delete_course_material, name='delete_course_material'),
]