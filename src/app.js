import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import stream from './ws/stream.js'; 


const options = {
    transports: ["websocket", "polling"],
    pingTimeout: 30000,
    pingInterval: 35000,
    cookie: false
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, options);

const PORT = process.env.PORT || 5056;
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname))

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

io.of('/stream').on('connection', (socket) => {
    stream(socket, io); // Pass 'io' as a parameter to the 'stream' function
});

httpServer.listen(PORT, () => {
    console.log(`Listening on port ${httpServer.address().port}...`);
});
