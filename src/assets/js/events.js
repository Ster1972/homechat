import helpers from './helpers.js';

window.addEventListener( 'load', () => {
    //When the 'Create room" is button is clicked
    document.getElementById( 'create-room' ).addEventListener( 'click', ( e ) => {
        e.preventDefault();

        let roomName = document.querySelector( '#room-name' ).value;
        if ( roomName ) {
            //remove error message, if any
            document.querySelector('#err-msg').innerText = "";

            //save the user's room in sessionStorage
            sessionStorage.setItem( 'room', roomName);

            //Share the room link with your partners.`;
             location.reload();
            //empty the values
            document.querySelector( '#room-name' ).value = '';
        }

        else {
            document.querySelector('#err-msg').innerText = "Entry required";
        }
    } );



    document.addEventListener( 'click', ( e ) => {
        if ( e.target && e.target.classList.contains( 'expand-remote-video' ) ) {
            helpers.maximiseStream( e );
        }

        else if ( e.target && e.target.classList.contains( 'mute-remote-mic' ) ) {
            helpers.singleStreamToggleMute( e );
        }
    } );


} );
