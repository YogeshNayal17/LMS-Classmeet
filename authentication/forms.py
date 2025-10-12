from django import forms
from django.contrib.auth.forms import UserCreationForm

class CustomUserCreationForm(UserCreationForm):
    ROLE_CHOICES = (
        ('Teacher', 'Teacher'),
        ('Student', 'Student'),
    )
    role = forms.ChoiceField(choices=ROLE_CHOICES, required=True)
