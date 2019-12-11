function isMobile() {
    return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

const frameLength = 200; // in ms

let trackedMatrix = new Ola( [
    0,0,0,0,
    0,0,0,0,
    0,0,0,0,
    0,0,0,0
], frameLength );

let markers = {
    'pinball': {
        width: 1637,
        height: 2048,
        dpi: 215,
        url: 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/181962/pinball',
    },
};

var setMatrix = function( matrix, value ) {
    let array = [];
    
    for( let key in value ) {
        array[key] = value[key];
    }
    
    if( typeof matrix.elements.set === 'function' ) {
        matrix.elements.set(array);
    } else {
        matrix.elements = [].slice.call( array );
    }
};

function start( container, marker, video, input_width, input_height, canvas_draw, render_update, track_update ) {
    let vw, vh;
    let sw, sh;
    let pscale, sscale;
    let w, h;
    let pw, ph;
    let ox, oy;
    let worker;

    let canvas_process = document.createElement( 'canvas' );
    let context_process = canvas_process.getContext( '2d' );

    
/**
 * RENDERER
 */
    let renderer = new THREE.WebGLRenderer( { 
        canvas: canvas_draw, 
        alpha: true, 
        antialias: true 
    } );
    
    renderer.setPixelRatio( window.devicePixelRatio );

    
/**
 * SCENE
 */
    let scene = new THREE.Scene();

    
/**
 * CAMERA
 */    
    let camera = new THREE.Camera();
    camera.matrixAutoUpdate = false;
    scene.add( camera );

    
    
/**
 * OBJECT
 */    
    let sphere = new THREE.Mesh(
        new THREE.SphereGeometry( 0.5, 8, 8 ),
        new THREE.MeshNormalMaterial()
    );

    sphere.material.shading = THREE.FlatShading;

    sphere.position.z = 0;
    sphere.position.x = 100;
    sphere.position.y = 100;
    sphere.scale.set( 200, 200, 200 );

    
/**
 * ROOT
 */    
    let root = new THREE.Object3D();
    root.matrixAutoUpdate = false;

    root.add( sphere );
    
    scene.add( root );    
    

    let load = () => {
        vw = input_width;
        vh = input_height;

        pscale = 320 / Math.max(vw, vh / 3 * 4);
        sscale = isMobile() ? window.outerWidth / input_width : 1;

        sw = vw * sscale;
        sh = vh * sscale;
        video.style.width = sw + "px";
        video.style.height = sh + "px";
        container.style.width = sw + "px";
        container.style.height = sh + "px";
        canvas_draw.style.clientWidth = sw + "px";
        canvas_draw.style.clientHeight = sh + "px";
        canvas_draw.width = sw;
        canvas_draw.height = sh;
        w = vw * pscale;
        h = vh * pscale;
        pw = Math.max(w, h / 3 * 4);
        ph = Math.max(h, w / 4 * 3);
        ox = (pw - w) / 2;
        oy = (ph - h) / 2;
        canvas_process.style.clientWidth = pw + "px";
        canvas_process.style.clientHeight = ph + "px";
        canvas_process.width = pw;
        canvas_process.height = ph;

        renderer.setSize( sw, sh );

        worker = new Worker( 'js/worker.js' );

        worker.postMessage( { 
            type: 'load', 
            pw: pw, 
            ph: ph, 
            marker: marker.url 
        } );

        worker.onmessage = ( event ) => {
            let message = event.data; 
            switch( message.type ) {
                case 'loaded': {                    
                    let proj = JSON.parse( message.proj );
                    let ratioW = pw / w;
                    let ratioH = ph / h;
                    
                    proj[0] *= ratioW;
                    proj[4] *= ratioW;
                    proj[8] *= ratioW;
                    proj[12] *= ratioW;
                    proj[1] *= ratioH;
                    proj[5] *= ratioH;
                    proj[9] *= ratioH;
                    proj[13] *= ratioH;
                    
                    // set camera matrix to detected 'projection' matrix
                    setMatrix( camera.projectionMatrix, proj );

                    document.body.classList.remove( 'loading' );
                    
                    break;
                }
                case 'found': {
                    found( message );
                    break;
                }
                case 'not found': {
                    found( null );
                    break;
                }
            }
            
            /**
             * Callback
             */
            track_update();
            
            process();
        };
    };

    
    let lastmsg = null;
    let found = ( message ) => {
        lastmsg = message;
    };

    let lasttime = Date.now();
    let time = 0;
    
    
    /** 
     * Renders the THREE.js scene
     */
    let draw = () => {
        /**
         * Callback 
         */
        render_update();
        
        let now = Date.now();
        let dt = now - lasttime;
        // time += dt;
        
        // limit rendering to 10 FPS;
        if( dt > frameLength ) {
            lasttime = now;                    
    
            if( !lastmsg ) {
                sphere.visible = false;
            } else {
                // let proj = JSON.parse( lastmsg.proj );
                let world = JSON.parse( lastmsg.matrixGL_RH );
                trackedMatrix[0] = world[0];
                trackedMatrix[1] = world[1];
                trackedMatrix[2] = world[2];
                trackedMatrix[3] = world[3];
                trackedMatrix[4] = world[4];
                trackedMatrix[5] = world[5];
                trackedMatrix[6] = world[6];
                trackedMatrix[7] = world[7];
                trackedMatrix[8] = world[8];
                trackedMatrix[9] = world[9];
                trackedMatrix[10] = world[10];
                trackedMatrix[11] = world[11];
                trackedMatrix[12] = world[12];
                trackedMatrix[13] = world[13];
                trackedMatrix[14] = world[14];
                trackedMatrix[15] = world[15];


                // console.log( world );

                let width = marker.width;
                let height = marker.height;
                let dpi = marker.dpi;

                let w = width / dpi * 2.54 * 10;
                let h = height / dpi * 2.54 * 10;

                sphere.visible = true;
            }
        }

        // set matrix of 'root' by detected 'world' matrix
        setMatrix( root.matrix, trackedMatrix );
        
        renderer.render( scene, camera );
    };

    /**
     * This is called on every frame 
     */ 
    function process() {
        // clear canvas
        context_process.fillStyle = 'black';
        context_process.fillRect( 0, 0, pw, ph );
        
        // draw video to canvas
        context_process.drawImage( video, 0, 0, vw, vh, ox, oy, w, h );
    
        // send video frame to worker
        let imageData = context_process.getImageData( 0, 0, pw, ph );
        worker.postMessage( 
            { 
                type: 'process', 
                imagedata: imageData 
            }, 
            [ 
                imageData.data.buffer
            ]
        );
    }
    
    
    let tick = () => {
        draw();
        
        requestAnimationFrame( tick );
    };
    
    

    load();
    tick();
    process();
}