# Project Overview: game_chat

`game_chat` is a real-time conference call application leveraging WebRTC for peer-to-peer media streaming, Socket.io for signaling, and Node.js with Express for the backend. It allows users to create or join rooms for video and audio communication.

## Key Technologies
- **Backend:** Node.js, Express, Socket.io
- **Frontend:** HTML5, CSS3 (Bootstrap 5), JavaScript (ES Modules)
- **Real-time Communication:** WebRTC (Peer Connection, Media Streams)
- **Signaling:** Socket.io (Events: `sdp`, `ice candidates`, `newUserStart`, `enter_into_call`)
- **Utilities:** `dotenv` for environment management, `nodemon` for development

## Project Structure
- `src/app.js`: The main entry point for the Node.js server. Configures Express, serves static files, and initializes the Socket.io server.
- `src/ws/stream.js`: Contains the server-side Socket.io logic. Manages room joining, user disconnections, and facilitates signaling (SDP and ICE candidate exchange).
- `src/assets/js/rtc.js`: The core client-side WebRTC logic. Handles peer connection lifecycle, media stream acquisition, and UI updates for remote videos.
- `src/assets/js/helpers.js`: A collection of client-side utility functions for media handling, UI manipulation (fullscreen, muting), and DOM management.
- `src/assets/js/events.js`: Manages client-side event listeners for initial room creation and UI interactions.
- `src/index.html`: The landing page where users enter a room name to join or create a session.
- `src/welcome.html`: The main conferencing interface where local and remote video streams are displayed.

## Building and Running

### Prerequisites
- Node.js installed on your system.
- Valid Xirsys credentials (`LOGONID` and `CREDENTIAL`) if using the configured TURN server.

### Installation
```bash
npm install
```

### Running the Project
```bash
npm start
```
By default, the server runs on port `5056` (or the port specified in the `PORT` environment variable).

### Environment Variables
Create a `.env` file in the root directory with the following variables:
- `PORT`: (Optional) The port to run the server on.
- `LOGONID`: Your Xirsys login ID.
- `CREDENTIAL`: Your Xirsys API credential.

## Development Conventions
- **ES Modules:** The project uses native ES Modules (`type: "module"` in `package.json`). Use `import`/`export` syntax.
- **Peer Management:** Peer connections are tracked in an array `pc` on the client side, indexed by the `socketId` of the remote participant.
- **Media Constraints:** Default video resolution is set to 720p (1280x720) with echo cancellation and noise suppression enabled for audio.
- **Styling:** Bootstrap 5 is used for layout and components, with some custom CSS in `src/assets/css/app.css` and inline styles.
- **Signaling Protocol:**
    - `enter_into_call`: Emitted when a user joins a room.
    - `new user`: Broadcast to existing room members when a new participant arrives.
    - `newUserStart`: Sent to initiate the WebRTC handshake.
    - `sdp`: Exchanges Session Description Protocol (Offer/Answer).
    - `ice candidates`: Exchanges ICE candidates for NAT traversal.
