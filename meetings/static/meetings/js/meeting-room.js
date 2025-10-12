class Meeting {
    constructor(meetingId, userId, userName) {
        this.meetingId = meetingId;
        this.userId = userId;
        this.userName = userName;
        this.peers = new Map();
        this.localStream = null;
        this.socket = null;
        this.peerConnection = null;

        // DOM elements
        this.videoGrid = document.getElementById('video-grid');
        this.audioBtn = document.getElementById('toggle-audio');
        this.videoBtn = document.getElementById('toggle-video');
        this.screenBtn = document.getElementById('share-screen');
        this.leaveBtn = document.getElementById('leave-meeting');

        // Bind methods
        this.toggleAudio = this.toggleAudio.bind(this);
        this.toggleVideo = this.toggleVideo.bind(this);
        this.toggleScreenShare = this.toggleScreenShare.bind(this);
        this.leaveMeeting = this.leaveMeeting.bind(this);

        // WebRTC configuration
        this.configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
            ]
        };

        this.init();
    }

    async init() {
        try {
            // Get user media
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });

            // Create and display local video
            this.createVideoElement(this.localStream, this.userId, true);

            // Initialize WebSocket connection
            this.initializeWebSocket();

            // Add event listeners
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

        this.socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.socket.onopen = () => {
            console.log('WebSocket connection established');
            this.socket.send(JSON.stringify({
                type: 'join',
                userId: this.userId,
                userName: this.userName
            }));
        };
    }

    async handleWebSocketMessage(data) {
        console.log('Received WebSocket message:', data);  // Debug log
        switch (data.type) {
            case 'user-joined':
                await this.handleUserJoined(data);
                break;
            case 'user-left':
                this.handleUserLeft(data);
                break;
            case 'offer':
                await this.handleOffer(data);
                break;
            case 'answer':
                await this.handleAnswer(data);
                break;
            case 'ice-candidate':
                await this.handleIceCandidate(data);
                break;
            default:
                console.log('Unknown message type:', data.type);
                break;
        }
    }

    async handleUserJoined(data) {
        const userId = data.userId;  // Changed to match server's field name
        const userName = data.userName;  // Changed to match server's field name
        console.log(`User joined: ${userName} (${userId})`);

        try {
            // Create a new peer connection
            const peerConnection = await this.createPeerConnection(userId, true);
            
            // Store peer information for the remote user
            this.peers.set(userId, {
                name: userName,
                connection: peerConnection
            });

            // Create and send offer
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            this.socket.send(JSON.stringify({
                type: 'offer',
                sdp: offer,
                targetUserId: userId
            }));

            // Update UI
            this.updateParticipantsList();
        } catch (error) {
            console.error('Error handling user joined:', error);
        }
    }

    handleUserLeft(data) {
        const userId = data.userId;  // Changed to match server's field name
        const userName = data.userName;  // Added to get the user's name
        console.log(`User left: ${userName} (${userId})`);

        // Remove video element
        const videoWrapper = document.getElementById(`video-wrapper-${userId}`);
        if (videoWrapper) {
            videoWrapper.remove();
        }

        // Close and remove peer connection
        const peer = this.peers.get(userId);
        if (peer) {
            peer.connection.close();
            this.peers.delete(userId);
        }

        // Update UI
        this.updateParticipantsList();
    }

    updateParticipantsList() {
        const participantsList = document.getElementById('participants-list');
        if (!participantsList) return;
        
        // Create list of all participants including local user
        const allParticipants = [{
            id: this.userId,
            name: 'You (Local)',
            isLocal: true
        }];
        
        // Add remote participants
        this.peers.forEach((peer, userId) => {
            allParticipants.push({
                id: userId,
                name: peer.name,
                isLocal: false
            });
        });

        // Update the participants list HTML
        participantsList.innerHTML = allParticipants.map(participant => `
            <div class="participant-item d-flex align-items-center mb-2">
                <div class="participant-status ${participant.isLocal ? 'bg-success' : 'bg-primary'} me-2"></div>
                <div>${participant.name}</div>
            </div>
        `).join('');
    }

    createVideoElement(stream, userId, isLocal = false) {
        const wrapper = document.createElement('div');
        wrapper.className = 'video-wrapper';
        wrapper.id = `video-wrapper-${userId}`;

        const video = document.createElement('video');
        video.srcObject = stream;
        video.id = `video-${userId}`;
        video.autoplay = true;
        video.playsInline = true;  // Added to support mobile devices
        if (isLocal) video.muted = true;

        const nameTag = document.createElement('div');
        nameTag.className = 'participant-name';
        const peer = this.peers.get(userId);
        nameTag.textContent = isLocal ? 'You' : (peer ? peer.name : 'Participant');

        wrapper.appendChild(video);
        wrapper.appendChild(nameTag);
        this.videoGrid.appendChild(wrapper);

        return wrapper;
    }

    async createPeerConnection(userId, isInitiator) {
        console.log('Creating peer connection for user:', userId);
        const peerConnection = new RTCPeerConnection(this.configuration);

        // Add local stream
        this.localStream.getTracks().forEach(track => {
            console.log('Adding track to peer connection:', track.kind);
            peerConnection.addTrack(track, this.localStream);
        });

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate);
                this.socket.send(JSON.stringify({
                    type: 'ice-candidate',
                    sdp: event.candidate,
                    targetUserId: userId
                }));
            }
        };

        // Log state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', peerConnection.connectionState);
        };

        // Handle incoming streams
        peerConnection.ontrack = (event) => {
            const stream = event.streams[0];
            if (!document.getElementById(`video-${userId}`)) {
                this.createVideoElement(stream, userId);
            }
        };

        return peerConnection;
    }

    // UI Event Handlers
    toggleAudio() {
        const audioTrack = this.localStream.getAudioTracks()[0];
        audioTrack.enabled = !audioTrack.enabled;
        this.audioBtn.classList.toggle('btn-danger', !audioTrack.enabled);
    }

    toggleVideo() {
        const videoTrack = this.localStream.getVideoTracks()[0];
        videoTrack.enabled = !videoTrack.enabled;
        this.videoBtn.classList.toggle('btn-danger', !videoTrack.enabled);
    }

    async toggleScreenShare() {
        try {
            if (this.screenStream) {
                // Stop screen sharing
                this.screenStream.getTracks().forEach(track => track.stop());
                this.screenStream = null;
                
                // Revert to camera
                const videoTrack = this.localStream.getVideoTracks()[0];
                this.peers.forEach(peer => {
                    const sender = peer.connection.getSenders().find(s => s.track.kind === 'video');
                    sender.replaceTrack(videoTrack);
                });
                
                this.screenBtn.classList.remove('btn-danger');
            } else {
                // Start screen sharing
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true
                });
                
                const screenTrack = this.screenStream.getVideoTracks()[0];
                this.peers.forEach(peer => {
                    const sender = peer.connection.getSenders().find(s => s.track.kind === 'video');
                    sender.replaceTrack(screenTrack);
                });
                
                this.screenBtn.classList.add('btn-danger');
                
                // Handle stream end
                screenTrack.onended = () => {
                    this.toggleScreenShare();
                };
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
            alert('Could not share screen. Please check permissions.');
        }
    }

    leaveMeeting() {
        // Stop all tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
        }

        // Close all peer connections
        this.peers.forEach(peer => {
            peer.connection.close();
        });

        // Close WebSocket connection
        if (this.socket) {
            this.socket.close();
        }

        // Redirect to course page
        window.location.href = this.courseUrl;
    }

    async handleOffer(data) {
        console.log('Received offer:', data);
        try {
            const fromUserId = data.from;
            
            // Create peer connection if it doesn't exist
            if (!this.peers.has(fromUserId)) {
                const peerConnection = await this.createPeerConnection(fromUserId, false);
                this.peers.set(fromUserId, {
                    connection: peerConnection,
                    name: data.userName || 'Participant'
                });
            }
            
            const peerConnection = this.peers.get(fromUserId).connection;
            
            // Set remote description
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            
            // Create and set local description
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            // Send answer
            this.socket.send(JSON.stringify({
                type: 'answer',
                sdp: answer,
                targetUserId: fromUserId
            }));
            
        } catch (error) {
            console.error('Error handling offer:', error);
        }
    }

    async handleAnswer(data) {
        console.log('Received answer:', data);
        try {
            const fromUserId = data.from;
            const peer = this.peers.get(fromUserId);
            
            if (peer && peer.connection) {
                await peer.connection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
        } catch (error) {
            console.error('Error handling answer:', error);
        }
    }

    async handleIceCandidate(data) {
        console.log('Received ICE candidate:', data);
        try {
            const fromUserId = data.from;
            const peer = this.peers.get(fromUserId);
            
            if (peer && peer.connection) {
                await peer.connection.addIceCandidate(new RTCIceCandidate(data.sdp));
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    }

    addEventListeners() {
        this.audioBtn.addEventListener('click', this.toggleAudio);
        this.videoBtn.addEventListener('click', this.toggleVideo);
        this.screenBtn.addEventListener('click', this.toggleScreenShare);
        this.leaveBtn.addEventListener('click', this.leaveMeeting);
    }
}

// Initialize meeting when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log(meetingInfo.id, currentUser.id, currentUser.name)
    const meeting = new Meeting(
        meetingInfo.id,
        currentUser.id,
        currentUser.name
    );
});