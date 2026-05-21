import h from './helpers.js';

let pc = {};
let candidateQueue = {};
let socket = io('/stream', { "forceWebsockets": true });
let socketId = '';
let myStream = null;
let myStreamPromise = null;
let screenStream = null;
let roomid = sessionStorage.getItem('roomName');
let currentLayout = 'quadrant'; // 'quadrant' or 'column'
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
        if (candidateQueue[userId]) {
            delete candidateQueue[userId];
        }
        h.closeVideo(`${userId}-video`);
    });

    socket.on('ice candidates', async (data) => {
        try {
            if (data.candidate && pc[data.sender]) {
                if (pc[data.sender].remoteDescription && pc[data.sender].remoteDescription.type) {
                    await pc[data.sender].addIceCandidate(data.candidate);
                } else {
                    // Queue candidate if remote description is not set
                    if (!candidateQueue[data.sender]) candidateQueue[data.sender] = [];
                    candidateQueue[data.sender].push(data.candidate);
                }
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
                
                // Process any queued candidates
                if (candidateQueue[data.sender]) {
                    for (const candidate of candidateQueue[data.sender]) {
                        await pc[data.sender].addIceCandidate(candidate);
                    }
                    delete candidateQueue[data.sender];
                }

                // If we don't have a stream yet, try to get it
                if (!myStream) {
                    await getAndSetUserStream();
                }

                const answer = await pc[data.sender].createAnswer();
                await pc[data.sender].setLocalDescription(answer);

                socket.emit('sdp', { 
                    description: pc[data.sender].localDescription, 
                    to: data.sender, 
                    sender: socketId 
                });
            } else if (data.description.type === 'answer') {
                await pc[data.sender].setRemoteDescription(data.description);
                
                // Process any queued candidates
                if (candidateQueue[data.sender]) {
                    for (const candidate of candidateQueue[data.sender]) {
                        await pc[data.sender].addIceCandidate(candidate);
                    }
                    delete candidateQueue[data.sender];
                }
            }
        } catch (e) {
            console.error('Error handling SDP:', e);
        }
    });
});

async function getAndSetUserStream() {
    if (myStreamPromise) return myStreamPromise;

    myStreamPromise = new Promise(async (resolve, reject) => {
        try {
            const stream = await h.getUserFullMedia();
            myStream = stream;
            h.setLocalStream(stream);
            resolve(stream);
        } catch (e) {
            console.error(`Stream error: ${e}`);
            myStreamPromise = null; // Reset to allow retry on next call
            if (e.name === 'NotFoundError') {
                alert('No camera or microphone found.');
            } else {
                alert('Could not access camera/microphone. Please check permissions.');
            }
            reject(e);
        }
    });

    return myStreamPromise;
}

async function init(createOffer, partnerName) {
    console.log('Initializing connection with:', partnerName, 'CreateOffer:', createOffer);
    
    pc[partnerName] = new RTCPeerConnection(iceServers);

    // ICE Candidate handler
    pc[partnerName].onicecandidate = ({ candidate }) => {
        socket.emit('ice candidates', { candidate, to: partnerName, sender: socketId });
    };

    // Track handler (Remote stream)
    pc[partnerName].ontrack = (e) => {
        const remoteStream = e.streams[0];
        const containerId = `${partnerName}-video`;
        const videoId = `${partnerName}-video-element`;
        
        let videoElem = document.getElementById(videoId);
        if (videoElem) {
            videoElem.srcObject = remoteStream;
        } else {
            videoElem = document.createElement('video');
            videoElem.id = videoId;
            videoElem.srcObject = remoteStream;
            videoElem.autoplay = true;
            videoElem.className = 'remote-video video-container';
            videoElem.disablePictureInPicture = true;

            const col = document.createElement('div');
            col.id = containerId;
            col.className = 'video-container-wrapper';
            col.appendChild(videoElem);
            
            document.getElementById('video-grid').appendChild(col);
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

    // Add local tracks asynchronously without blocking the init process
    getAndSetUserStream().then(stream => {
        const currentStream = screenStream || stream;
        if (currentStream && pc[partnerName]) {
            currentStream.getTracks().forEach((track) => {
                pc[partnerName].addTrack(track, currentStream);
            });
        }
    }).catch(e => console.error('Error adding tracks in init:', e));
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

document.getElementById('toggle-layout').addEventListener('click', (e) => {
    e.preventDefault();
    
    const grid = document.getElementById('video-grid');
    const icon = document.getElementById('buttonLayout');
    const btn = document.getElementById('toggle-layout');

    if (currentLayout === 'quadrant') {
        // Switch to Column View
        currentLayout = 'column';
        grid.classList.remove('quadrant-layout');
        grid.classList.add('column-layout');
        icon.className = 'bi bi-grid-3x3-gap-fill';
        btn.title = "Quadrant View";
    } else {
        // Switch to Quadrant View
        currentLayout = 'quadrant';
        grid.classList.remove('column-layout');
        grid.classList.add('quadrant-layout');
        icon.className = 'bi bi-view-stacked';
        btn.title = "Column View";
    }
});

document.getElementById('disconnect-btn').addEventListener('click', (e) => {
    e.preventDefault();
    
    // Stop local media stream tracks so camera/mic lights go off
    if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }
    
    // Close all peer connections
    for (const id in pc) {
        if (pc[id]) {
            pc[id].close();
        }
    }
    pc = {};
    
    // Disconnect socket from namespace
    socket.disconnect();
    
    // Redirect user back to the home entry portal page
    window.location.href = "/";
});
