
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from .models import Discussion, Comment
from .forms import DiscussionForm, CommentForm
from notifications.models import Notification

@login_required
def discussion_list(request):
    discussions = Discussion.objects.all().order_by('-created_at')
    return render(request, 'discussions/discussion_list.html', {'discussions': discussions})

@login_required
def create_discussion(request):
    if request.method == 'POST':
        form = DiscussionForm(request.POST)
        if form.is_valid():
            discussion = form.save(commit=False)
            discussion.author = request.user
            discussion.save()
            discussion.upvoters.add(request.user)

            # Notify all other users
            other_users = User.objects.exclude(id=request.user.id)
            for user in other_users:
                Notification.objects.create(
                    recipient=user,
                    sender=request.user,
                    message=f'{request.user.username} started a new discussion: "{discussion.title}"',
                    discussion=discussion
                )

            return redirect('discussion_detail', discussion_id=discussion.id)
    else:
        form = DiscussionForm()
    return render(request, 'discussions/create_discussion.html', {'form': form})

@login_required
def discussion_detail(request, discussion_id):
    discussion = get_object_or_404(Discussion, id=discussion_id)
    comments = discussion.comments.all().order_by('created_at')
    comment_form = CommentForm()

    if request.method == 'POST':
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.discussion = discussion
            comment.author = request.user
            comment.save()

            # Notify the discussion author
            if discussion.author != request.user:
                Notification.objects.create(
                    recipient=discussion.author,
                    sender=request.user,
                    message=f'{request.user.username} commented on your discussion: "{discussion.title}"',
                    discussion=discussion
                )

            return redirect('discussion_detail', discussion_id=discussion.id)

    return render(request, 'discussions/discussion_detail.html', {
        'discussion': discussion,
        'comments': comments,
        'comment_form': comment_form
    })

@login_required
def upvote_discussion(request, discussion_id):
    discussion = get_object_or_404(Discussion, id=discussion_id)
    user = request.user

    if user in discussion.upvoters.all():
        discussion.upvoters.remove(user)
    else:
        discussion.upvoters.add(user)
        # Notify the discussion author only when adding an upvote
        if discussion.author != user:
            Notification.objects.create(
                recipient=discussion.author,
                sender=user,
                message=f'{user.username} upvoted your discussion: "{discussion.title}"',
                discussion=discussion
            )
    
    return redirect('discussion_detail', discussion_id=discussion.id)
