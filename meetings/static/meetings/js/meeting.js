// WebRTC configuration
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

class MeetingRoom {
    constructor(meetingId, userId, userName) {
        this.meetingId = meetingId;
        this.userId = userId;
        this.userName = userName;
        this.peerConnections = new Map(); // userId -> RTCPeerConnection
        this.localStream = null;
        this.socket = null;

        // DOM elements
        this.videoGrid = document.getElementById('video-grid');
        this.participantsList = document.getElementById('participants-list');
        
        // Control buttons
        this.audioBtn = document.getElementById('toggle-audio');
        this.videoBtn = document.getElementById('toggle-video');
        this.screenBtn = document.getElementById('share-screen');
        this.leaveBtn = document.getElementById('leave-meeting');

        this.init();
    }

    async init() {
        try {
            // Get user's media stream
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            // Display local video
            this.addVideoStream(this.userId, this.localStream, true);

            // Initialize WebSocket connection
            this.initializeWebSocket();

            // Add event listeners for control buttons
            this.addEventListeners();

        } catch (error) {
            console.error('Error initializing meeting:', error);
            alert('Could not access camera/microphone. Please check permissions.');
        }
    }

    initializeWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/meeting/${this.meetingId}/`;
        
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket Connected');
            this.sendToServer({
                type: 'join'
            });
        };

        this.socket.onmessage = async (event) => {
            console.log('WebSocket message received:', event.data);
            const data = JSON.parse(event.data);
            await this.handleSignalingMessage(data);
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
        };
    }

    async handleSignalingMessage(data) {
        console.log('Received message:', data);  // Debug log
        switch(data.type) {
            case 'user-joined':
                await this.handleUserJoined(data.user_id, data.user_name);  // Changed to match server message
                break;
            case 'user-left':
                this.handleUserLeft(data.user_id);  // Changed to match server message
                break;
            case 'offer':
                await this.handleOffer(data);
                break;
            case 'answer':
                await this.handleAnswer(data);
                break;
            case 'ice-candidate':
                await this.handleNewICECandidate(data);
                break;
        }
    }

    async handleUserJoined(userId, userName) {
        console.log(`User joined: ${userName}`);
        
        // Create new peer connection
        const peerConnection = new RTCPeerConnection(configuration);
        this.peerConnections.set(userId, peerConnection);

        // Add local stream to peer connection
        this.localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, this.localStream);
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendToServer({
                    type: 'ice-candidate',
                    sdp: event.candidate,
                    targetUserId: userId
                });
            }
        };

        // Handle incoming streams
        peerConnection.ontrack = (event) => {
            if (!document.getElementById(`video-${userId}`)) {
                this.addVideoStream(userId, event.streams[0], false, userName);
            }
        };

        // Create and send offer
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            this.sendToServer({
                type: 'offer',
                offer: offer,
                targetUserId: userId
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }

        // Update participants list
        this.updateParticipantsList();
    }

    handleUserLeft(userId) {
        // Remove video element
        const videoElement = document.getElementById(`video-${userId}`);
        if (videoElement) {
            videoElement.parentElement.remove();
        }

        // Close and remove peer connection
        const peerConnection = this.peerConnections.get(userId);
        if (peerConnection) {
            peerConnection.close();
            this.peerConnections.delete(userId);
        }

        // Update participants list
        this.updateParticipantsList();
    }

    async handleOffer(data) {
        const peerConnection = new RTCPeerConnection(configuration);
        this.peerConnections.set(data.from, peerConnection);

        // Add local stream
        this.localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, this.localStream);
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendToServer({
                    type: 'ice-candidate',
                    candidate: event.candidate,
                    targetUserId: data.from
                });
            }
        };

        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            if (!document.getElementById(`video-${data.from}`)) {
                this.addVideoStream(data.from, event.streams[0], false);
            }
        };

        // Set remote description and create answer
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            this.sendToServer({
                type: 'answer',
                answer: answer,
                targetUserId: data.from
            });
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(data) {
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (error) {
                console.error('Error handling answer:', error);
            }
        }
    }

    async handleNewICECandidate(data) {
        const peerConnection = this.peerConnections.get(data.from);
        if (peerConnection) {
            try {
                const candidate = new RTCIceCandidate(data.sdp);
                await peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }

    addVideoStream(userId, stream, isLocal, userName = null) {
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-wrapper';
        videoContainer.id = `video-container-${userId}`;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.id = `video-${userId}`;
        video.autoplay = true;
        if (isLocal) video.muted = true;

        const label = document.createElement('div');
        label.className = 'video-label';
        label.textContent = isLocal ? 'You' : (userName || 'Participant');

        videoContainer.appendChild(video);
        videoContainer.appendChild(label);
        this.videoGrid.appendChild(videoContainer);
    }

    updateParticipantsList() {
        const participants = Array.from(this.peerConnections.keys()).map(userId => ({
            id: userId,
            name: document.querySelector(`#video-container-${userId} .video-label`).textContent
        }));

        // Add local user to the list
        participants.unshift({
            id: this.userId,
            name: 'You'
        });


        this.participantsList.innerHTML = participants.map(p => `
            <div class="participant-item d-flex align-items-center mb-2">
                <div class="participant-status me-2"></div>
                <div>${p.name}</div>
            </div>
        `).join('');
    }

    sendToServer(message) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
        }
    }

    addEventListeners() {
        // Audio toggle
        this.audioBtn.addEventListener('click', () => {
            const audioTrack = this.localStream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            this.audioBtn.classList.toggle('active', audioTrack.enabled);
            this.audioBtn.querySelector('i').className = audioTrack.enabled ? 
                'fas fa-microphone' : 'fas fa-microphone-slash';
        });

        // Video toggle
        this.videoBtn.addEventListener('click', () => {
            const videoTrack = this.localStream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled;
            this.videoBtn.classList.toggle('active', videoTrack.enabled);
            this.videoBtn.querySelector('i').className = videoTrack.enabled ? 
                'fas fa-video' : 'fas fa-video-slash';
        });

        // Screen sharing
        this.screenBtn.addEventListener('click', async () => {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });

                const videoTrack = screenStream.getVideoTracks()[0];
                
                // Replace video track in all peer connections
                this.peerConnections.forEach(pc => {
                    const sender = pc.getSenders().find(s => s.track.kind === 'video');
                    sender.replaceTrack(videoTrack);
                });

                // Update local video
                const localVideo = document.getElementById(`video-${this.userId}`);
                localVideo.srcObject = new MediaStream([videoTrack]);

                // Handle stream end
                videoTrack.onended = () => {
                    const cameraTrack = this.localStream.getVideoTracks()[0];
                    this.peerConnections.forEach(pc => {
                        const sender = pc.getSenders().find(s => s.track.kind === 'video');
                        sender.replaceTrack(cameraTrack);
                    });
                    localVideo.srcObject = this.localStream;
                };

            } catch (error) {
                console.error('Error sharing screen:', error);
            }
        });

        // Leave meeting
        this.leaveBtn.addEventListener('click', () => {
            // Stop all tracks
            this.localStream.getTracks().forEach(track => track.stop());
            
            // Close all peer connections
            this.peerConnections.forEach(pc => pc.close());
            
            // Close WebSocket
            this.socket.close();
            
            // Redirect to meeting list
            window.location.href = '/meetings/';
        });
    }
}

// Initialize meeting room when page loads
document.addEventListener('DOMContentLoaded', () => {
    const meetingRoom = new MeetingRoom(
        meetingInfo.id,
        currentUser.id,
        currentUser.name
    );
});