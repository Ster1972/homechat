import h from './helpers.js';

let pc = {};
let socket = io('/stream', { "forceWebsockets": true });
let socketId = '';
let myStream = null;
let screenStream = null;
let roomid = sessionStorage.getItem('roomName');
let iceServers = null;

// Initial stream acquisition
getAndSetUserStream();

socket.on('connect', () => {
    socketId = socket.id;

    // Fetch ICE servers once on connection
    socket.emit('iceserver');

    socket.on('ice', (data) => {
        iceServers = data;
        // Only enter call after we have ICE servers
        socket.emit('enter_into_call', {
            room: roomid,
            socketId: socketId
        });
    });

    socket.on('room-full', () => {
        alert('This room is full (maximum 4 participants). Please try another room.');
        window.location.href = "/";
    });

    socket.on('new user', (data) => {
        console.log('New participant joined:', data.socketId);
        socket.emit('newUserStart', { to: data.socketId, sender: socketId });
        init(true, data.socketId);
    });

    socket.on('newUserStart', (data) => {
        console.log('Initiating handshake with:', data.sender);
        init(false, data.sender);
    });

    socket.on('user-disconnected', userId => {
        console.log('User disconnected:', userId);
        if (pc[userId]) {
            pc[userId].close();
            delete pc[userId];
        }
        h.closeVideo(`${userId}-video`);
    });

    socket.on('ice candidates', async (data) => {
        try {
            if (data.candidate && pc[data.sender]) {
                await pc[data.sender].addIceCandidate(data.candidate);
            }
        } catch (e) {
            console.error('Error adding ICE candidate:', e);
        }
    });

    socket.on('sdp', async (data) => {
        try {
            if (!pc[data.sender]) return;

            if (data.description.type === 'offer') {
                await pc[data.sender].setRemoteDescription(data.description);
                
                // If we don't have a stream yet, try to get it
                if (!myStream) {
                    await getAndSetUserStream();
                }

                // Answer is created after tracks are added in init or here if needed
                // But tracks are already added in init(false, data.sender) called by newUserStart
                const answer = await pc[data.sender].createAnswer();
                await pc[data.sender].setLocalDescription(answer);

                socket.emit('sdp', { 
                    description: pc[data.sender].localDescription, 
                    to: data.sender, 
                    sender: socketId 
                });
            } else if (data.description.type === 'answer') {
                await pc[data.sender].setRemoteDescription(data.description);
            }
        } catch (e) {
            console.error('Error handling SDP:', e);
        }
    });
});

async function getAndSetUserStream() {
    try {
        const stream = await h.getUserFullMedia();
        myStream = stream;
        h.setLocalStream(stream);
        return stream;
    } catch (e) {
        console.error(`Stream error: ${e}`);
        if (e.name === 'NotFoundError') {
            alert('No camera or microphone found.');
        } else {
            alert('Could not access camera/microphone. Please check permissions.');
        }
    }
}

async function init(createOffer, partnerName) {
    console.log('Initializing connection with:', partnerName, 'CreateOffer:', createOffer);
    
    pc[partnerName] = new RTCPeerConnection(iceServers);

    // Add local tracks to the peer connection
    const currentStream = screenStream || myStream;
    if (currentStream) {
        currentStream.getTracks().forEach((track) => {
            pc[partnerName].addTrack(track, currentStream);
        });
    }

    // ICE Candidate handler
    pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit('ice candidates', { candidate, to: partnerName, sender: socketId });
    };

    // Track handler (Remote stream)
    pc[partnerName].ontrack = (e) => {
        const remoteStream = e.streams[0];
        const videoId = `${partnerName}-video`;
        
        let videoElem = document.getElementById(videoId);
        if (videoElem) {
            videoElem.srcObject = remoteStream;
        } else {
            videoElem = document.createElement('video');
            videoElem.id = videoId;
            videoElem.srcObject = remoteStream;
            videoElem.autoplay = true;
            videoElem.className = 'remote-video video-container';
            videoElem.style.marginLeft = '22px';
            videoElem.disablePictureInPicture = true;

            const row = document.createElement('div');
            row.className = 'row d-flex justify-content-center align-items-center mt-2';
            row.appendChild(videoElem);
            document.getElementById('videos').appendChild(row);
        }
    };

    // Connection state monitoring
    pc[partnerName].onconnectionstatechange = () => {
        console.log(`Connection state with ${partnerName}: ${pc[partnerName].connectionState}`);
        if (['disconnected', 'failed', 'closed'].includes(pc[partnerName].connectionState)) {
            h.closeVideo(`${partnerName}-video`);
        }
    };

    // Negotiation handler
    if (createOffer) {
        pc[partnerName].onnegotiationneeded = async () => {
            try {
                const offer = await pc[partnerName].createOffer();
                await pc[partnerName].setLocalDescription(offer);
                socket.emit('sdp', { 
                    description: pc[partnerName].localDescription, 
                    to: partnerName, 
                    sender: socketId 
                });
            } catch (e) {
                console.error('Negotiation error:', e);
            }
        };
    }
}

// UI Event Listeners
document.getElementById('toggle-video').addEventListener('click', (e) => {
    e.preventDefault();
    if (!myStream) return;

    const track = myStream.getVideoTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;
    
    const icon = document.getElementById('buttonVideo');
    const btn = document.getElementById('toggle-video');
    
    if (track.enabled) {
        icon.className = 'bi bi-camera-video-fill';
        btn.title = "Hide Video";
    } else {
        icon.className = 'bi bi-camera-video-off-fill';
        btn.title = "Show Video";
    }
});

document.getElementById('toggle-mute').addEventListener('click', (e) => {
    e.preventDefault();
    if (!myStream) return;

    const track = myStream.getAudioTracks()[0];
    if (!track) return;

    track.enabled = !track.enabled;

    const icon = document.getElementById('buttonAudio');
    const btn = document.getElementById('toggle-mute');

    if (track.enabled) {
        icon.className = 'bi bi-mic-fill';
        btn.title = "Mute";
    } else {
        icon.className = 'bi bi-mic-mute-fill';
        btn.title = "Unmute";
    }
});
