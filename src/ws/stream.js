import fs from 'fs';

const stream = ( socket, io ) => {
    socket.on( 'enter_into_call', ( data ) => {
        //join a room and the session
        socket.join( data.room );
        const clients = socket.adapter.rooms.get(data.room);
        const numClients = clients ? clients.size : 0;
        //Inform other members in the room of new user's arrival
        if ( numClients > 1 ) {
            console.log('another user joining call')
            socket.to( data.room ).emit( 'new user', { socketId: data.socketId } );
        }

        socket.on('disconnect', () => {
            console.log('user disconnected', data.socketId)
            socket.to( data.room ).emit( 'user-disconnected', data.socketId)
        });

    } );


    socket.on( 'newUserStart', ( data ) => {
        console.log('newUserStart', data)
        socket.to( data.to ).emit( 'newUserStart', { sender: data.sender } );
    } );


    socket.on( 'sdp', ( data ) => {
        socket.to( data.to ).emit( 'sdp', { description: data.description, sender: data.sender } );
    } );


    socket.on( 'ice candidates', ( data ) => {
        socket.to( data.to ).emit( 'ice candidates', { candidate: data.candidate, sender: data.sender } );
    } );

    
    socket.on('iceserver', () =>{
        console.log('iceserver')
        socket.emit('ice', getIceServer)
    })
    

    let getIceServer =  {
        iceServers: [ 
           {
               urls: ["stun:us-turn5.xirsys.com"]
           },
           {
                username: process.env.LOGONID,
                credential: process.env.CREDENTIAL,

                urls: [
                        "turn:us-turn5.xirsys.com:80?transport=udp",
                        "turn:us-turn5.xirsys.com:3478?transport=udp",
                        "turn:us-turn5.xirsys.com:80?transport=tcp",
                        "turn:us-turn5.xirsys.com:3478?transport=tcp",
                        "turns:us-turn5.xirsys.com:443?transport=tcp",
                        "turns:us-turn5.xirsys.com:5349?transport=tcp"
                ],
            },
            {
                urls:[
                        'stun:stun.l.google.com:19302',
                        'stun:stun1.l.google.com:19302'
                   ],
            },
        ]
    };




};
    
export default stream;

