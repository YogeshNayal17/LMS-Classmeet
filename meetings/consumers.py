import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Meeting

class MeetingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meeting_id = self.scope['url_route']['kwargs']['meeting_id']
        self.room_group_name = f'meeting_{self.meeting_id}'
        self.user = self.scope['user']

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Notify others that user has left
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_left',
                'user_id': str(self.user.id),
                'user_name': self.user.get_full_name() or self.user.username
            }
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'join':
            # Broadcast to others in the room that a new user joined
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_joined',
                    'user_id': str(self.user.id),
                    'user_name': self.user.get_full_name() or self.user.username
                }
            )
        elif message_type in ['offer', 'answer', 'ice-candidate']:
            # Convert hyphenated message type to underscore for handler method name
            handler_type = message_type.replace('-', '_')
            # Forward WebRTC signaling messages to the appropriate peer
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': handler_type,  # Use underscored version for handler method
                    'data': data,
                    'sender_id': str(self.user.id)
                }
            )

    async def user_joined(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'user-joined',
            'userId': event['user_id'],
            'userName': event['user_name']
        }))

    async def user_left(self, event):
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'user-left',
            'userId': event['user_id'],
            'userName': event['user_name']
        }))

    async def offer(self, event):
        """Forward offer to the appropriate peer"""
        if str(self.user.id) != event['sender_id']:
            await self.send(text_data=json.dumps({
                'type': 'offer',
                'sdp': event['data'].get('sdp'),
                'from': event['sender_id']
            }))

    async def answer(self, event):
        """Forward answer to the appropriate peer"""
        if str(self.user.id) != event['sender_id']:
            await self.send(text_data=json.dumps({
                'type': 'answer',
                'sdp': event['data'].get('sdp'),
                'from': event['sender_id']
            }))

    async def ice_candidate(self, event):
        """Handle ICE candidate messages"""
        if str(self.user.id) != event['sender_id']:
            await self.send(text_data=json.dumps({
                'type': 'ice-candidate',  # Ensure consistent hyphenated format
                'candidate': event['data'].get('candidate'),
                'from': event['sender_id']
            }))