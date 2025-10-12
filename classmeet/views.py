from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from .models import Course, CourseMaterial
from .forms import CourseForm, CourseMaterialForm

def teacher_required(function):
    return user_passes_test(lambda u: u.groups.filter(name='Teacher').exists(), login_url='/')(function)

@login_required
def dashboard(request):
    if request.user.groups.filter(name='Teacher').exists():
        role = 'Teacher'
        courses = Course.objects.filter(teacher=request.user)
    else:
        role = 'Student'
        courses = Course.objects.all()
    return render(request, 'classmeet/dashboard.html', {'courses': courses, 'role': role})

@login_required
@teacher_required
def create_course(request):
    if request.method == 'POST':
        form = CourseForm(request.POST, request.FILES)
        if form.is_valid():
            course = form.save(commit=False)
            course.teacher = request.user
            course.save()
            return redirect('dashboard')
    else:
        form = CourseForm()
    return render(request, 'classmeet/create_course.html', {'form': form})

@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    materials = course.materials.all()
    return render(request, 'classmeet/course_detail.html', {'course': course, 'materials': materials})

@login_required
@teacher_required
def add_course_material(request, course_id):
    course = get_object_or_404(Course, id=course_id, teacher=request.user)
    if request.method == 'POST':
        form = CourseMaterialForm(request.POST, request.FILES)
        if form.is_valid():
            material = form.save(commit=False)
            material.course = course
            material.save()
            return redirect('course_detail', course_id=course.id) # Redirect to course detail
    else:
        form = CourseMaterialForm()
    return render(request, 'classmeet/add_course_material.html', {'form': form, 'course': course})

@login_required
@teacher_required
def delete_course(request, course_id):
    course = get_object_or_404(Course, id=course_id, teacher=request.user)
    if request.method == 'POST':
        course.delete()
        return redirect('dashboard')
    return redirect('dashboard') # Or render a confirmation page

@login_required
@teacher_required
def delete_course_material(request, material_id):
    material = get_object_or_404(CourseMaterial, id=material_id)
    # Ensure the user is the teacher of the course associated with the material
    if request.user != material.course.teacher:
        return redirect('dashboard') # Or show an error message
    
    if request.method == 'POST':
        course_id = material.course.id
        material.delete()
        return redirect('course_detail', course_id=course_id)
    return redirect('course_detail', course_id=material.course.id) # Or render a confirmation page
