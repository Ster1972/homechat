A demo stand alone WEBRTC app 

server side

// Import the fs module for file handling
import fs from 'fs';

// Inside the stream function
socket.on('file-transfer', async (data) => {
    const { file, receiverId } = data;
    const receiverSocket = io.sockets.sockets.get(receiverId);

    if (receiverSocket) {
        // Read the file data
        const fileData = fs.readFileSync(file.path);

        // Send the file data to the receiver
        receiverSocket.emit('file-receive-request', {
            senderId: socket.id,
            fileData: fileData,
            fileName: file.name
        });
    }
});

socket.on('file-receive-response', (data) => {
    const { senderId, fileData, fileName } = data;
    
    // Process the received file data as needed
});
/////////////////////////////////////////////////
client side
//////////////////////////////
// Add the file input element in your HTML and associate it with the following event listener
document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    const receiverId = prompt('Enter the receiver ID:'); // You may want to implement a more user-friendly way to select the receiver

    if (file && receiverId) {
        socket.emit('file-transfer', { file, receiverId });
    }
});

// Add event listeners for file receiving and approval
socket.on('file-receive-request', (data) => {
    const { senderId, fileData, fileName } = data;
    const approval = confirm(`You received a file from ${senderId}. Do you want to accept it?`);

    if (approval) {
        socket.emit('file-receive-response', { senderId, approved: true });
        // Process the received file data
    } else {
        socket.emit('file-receive-response', { senderId, approved: false });
    }
});
