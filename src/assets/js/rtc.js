import h from './helpers.js';

        let pc = [];

        let socket = io( '/stream', {"forceWebsockets": true });

        let socketId = '';
        let myStream = '';
        let screen = '';
        let roomid = sessionStorage.getItem('roomName');

        //Get user video by default
        getAndSetUserStream();

        socket.on( 'connect', () => {
            socketId = socket.id
            socket.emit( 'enter_into_call', {
                room: roomid,
                socketId: socketId
            } );
            // this section only occurs if there are two users or more
            socket.on( 'new user', ( data ) => {
                console.log('additional participant joined ', data.socketId, socketId)
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId } );
                pc.push( data.socketId );
                console.log('pc array = ', pc)
                init( true, data.socketId );
            } );


            socket.on( 'newUserStart', ( data ) => {
                pc.push( data.sender );
                console.log('list of other users',pc)
                init( false, data.sender );
            } );


            socket.on('user-disconnected', userId => {
                console.log('user disconnected', userId, pc)
                if ( document.getElementById( `${userId}-video` ) ) {
                  
                    document.getElementById( `${userId}-video` ).remove();
                }
            })

            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
            } );


            socket.on( 'sdp', async ( data ) => {
                if ( data.description.type === 'offer' ) {
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

                    h.getUserFullMedia().then( async ( stream ) => {
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            h.setLocalStream( stream );
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach( ( track ) => {
                            pc[data.sender].addTrack( track, stream );
                        } );

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription( answer );

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                }
            } );

        } );


        function getAndSetUserStream() {
            h.getUserFullMedia().then( ( stream ) => {
                //save my video and audio stream
                myStream = stream;

                h.setLocalStream( stream );
            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
            } );
        }

        function init( createOffer, partnerName ) {
            console.log('init.... ', createOffer, partnerName)
            let ice
            socket.emit('iceserver', () => {
                console.log(data)
            })
            socket.on('ice', (data)=>{
                ice = data
            })
            
            pc[partnerName] = new RTCPeerConnection( ice );
            console.log('partName', pc[partnerName])

            if ( screen && screen.getTracks().length ) {
                console.log("STEP ONE")
                screen.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                console.log("STEP TWO")
                myStream.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                console.log("STEP Three")
                h.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[partnerName].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    h.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }



            //create offer
            if ( createOffer ) {
                pc[partnerName].onnegotiationneeded = async () => {
                    let offer = await pc[partnerName].createOffer();

                    await pc[partnerName].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId } );
                };
            }



            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ( { candidate } ) => {
                socket.emit( 'ice candidates', { candidate: candidate, to: partnerName, sender: socketId } );
            };



            //add
            pc[partnerName].ontrack = ( e ) => {
                let str = e.streams[0];
                if ( document.getElementById( `${ partnerName }-video` ) ) {
                    document.getElementById( `${ partnerName }-video` ).srcObject = str;
                }

                else {
                    //video elem
                    let newVid = document.createElement( 'video' );
                    newVid.id = `${ partnerName }-video`;
                    newVid.srcObject = str;
                    newVid.autoplay = true
                    newVid.className = 'remote-video video-container'
                    newVid.style.marginLeft = '22px'; // Set the left margin
                    newVid.disablePictureInPicture = true;

                     // Create a new row for each remote video
                    let newRow = document.createElement('div');
                    newRow.className = 'row d-flex justify-content-center align-items-center mt-2';
                    newRow.appendChild(newVid);

                    // Append the new row to the videos container
                    document.getElementById('videos').appendChild(newRow);
                            
                }
            };



            pc[partnerName].onconnectionstatechange = ( d ) => {
                switch ( pc[partnerName].iceConnectionState ) {
                    case 'disconnected':
                    case 'failed':
                        h.closeVideo( partnerName );
                        break;

                    case 'closed':
                        h.closeVideo( partnerName );
                        break;
                }
            };



            pc[partnerName].onsignalingstatechange = ( d ) => {
                switch ( pc[partnerName].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        h.closeVideo( partnerName );
                        break;
                }
            };
        }







        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            h.setLocalStream( stream, mirrorMode );

            let track = type === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] === 'object' ) {
                    h.replaceTrack( track, pc[pName] );
                }
            }
        }


        //When the video mute icon is clicked
        document.getElementById('toggle-video').addEventListener('click', (e) => {
            e.preventDefault();
            console.log('toggle video working')
            let iconVideo = document.getElementById('buttonVideo')
            if (myStream.getVideoTracks()[0].enabled){
              if (e.target.classList.contains('btn-secondary')){
              iconVideo.className = 'bi bi-camera-video-off-fill'
              myStream.getVideoTracks()[0].enabled = false;
              }
              else if (e.target.classList.contains('bi-camera-video-fill') || e.target.classList.contains('btn-secondary')){
                e.target.classList.remove('bi-camera-video-fill');
                e.target.classList.add('bi-camera-video-off-fill');
                myStream.getVideoTracks()[0].enabled = false;
                }
              }
            else {
              if (e.target.classList.contains('btn-secondary')){
                  iconVideo.className = 'bi bi-camera-video-fill'
                  myStream.getVideoTracks()[0].enabled = true;
              }
              else if(e.target.classList.contains('bi-camera-video-off-fill') || e.target.classList.contains('btn-secondary')){
                  e.target.classList.remove('bi-camera-video-off-fill');
                  e.target.classList.add('bi-camera-video-fill');
                  myStream.getVideoTracks()[0].enabled = true;
              }
            }
          broadcastNewTracks(myStream, 'video')
          
          })

        //When the audio mute icon is clicked
document.getElementById('toggle-mute').addEventListener('click', (e) => {
    e.preventDefault();
    console.log('audio on/off')
    let iconAudio = document.getElementById('buttonAudio')
      if (myStream.getAudioTracks()[0].enabled){
        if (e.target.classList.contains('btn-secondary')){
          iconAudio.className = 'bi bi-mic-mute-fill'
          myStream.getAudioTracks()[0].enabled = false;
        }
        else if (e.target.classList.contains('bi-mic-fill')){
          e.target.classList.remove('bi-mic-fill');
          e.target.classList.add('bi-mic-mute-fill');
          myStream.getAudioTracks()[0].enabled = false;
          }
      }
      else {
        if (e.target.classList.contains('btn-secondary')){
            iconAudio.className = 'bi bi-mic-fill'
            myStream.getAudioTracks()[0].enabled = true;
        }
        else if(e.target.classList.contains('bi-mic-mute-fill')){
            e.target.classList.remove('bi-mic-mute-fill');
            e.target.classList.add('bi-mic-fill');
            myStream.getAudioTracks()[0].enabled = true;
        }
      }
    broadcastNewTracks(myStream, 'audio')
    });
    