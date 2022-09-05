console.log("hello");
var __wsconn = null;
var __url = ""

function getus() {
    return (performance.now() * 1000).toFixed();
}

function wsconnOnMessage(event) {
    var data = event.data;
    var msg = JSON.parse(data);

    console.log(msg)

    if (msg.type == "sessions") {
        var selects = document.getElementById("select_sessions")
        var child = selects.lastElementChild;
        while (child) {
            selects.removeChild(child);
            child = selects.lastElementChild;
        }

        msg.ids.forEach(element => {
            var opt = document.createElement("option");
            console.log("add " + element);
            opt.value = element;
            opt.text = element;
            selects.appendChild(opt);

        });
    } else if (msg.type == "error") {
        console.log("ERROR: " + msg.reason);
    } else if (msg.type == "connection_ready") {
        console.log("connection ready");
    } else if (msg.type == "control_data") {
        if (msg.msg.type == "ping") {
            console.log("control_data -> ping");
            __wsconn.send(JSON.stringify({
                type: "control_data",
                msg: {
                    type: "pong",
                    time: msg.msg.time,
                }

            }))
        } else if (msg.msg.type == "pong") {
            console.log("control_data -> pong");
            time_now = getus();
            time_before = msg.msg.time;
            diff = time_now - time_before;
            console.log("rtt[us] = " + diff);
            document.getElementById("div_rtt_ms").innerText = "RTT = " + diff / 1000 + "ms";
        }
    } else if (msg.type == "data") {
        console.log("data received " + msg.data.length + "bytes");
        console.log(__decoder)
        if (__decoder != null) {
            console.log(msg.data)
            if (__keyframe_received == false && msg.data.type != "key") {
                console.log("waiting for key " + msg.data.type);
                return;
            }
            if (__keyframe_received == false && msg.data.type == "key") {
                console.log("keyframe arrived")
                console.log(msg.data)
            }
            __keyframe_received = true;

            console.log(msg.data)
            console.log(msg.data.data)
            console.log(Object.values(msg.data.data))
            console.log(typeof(msg.data.data))
            console.log(new Uint8Array(msg.data.data))

            let ary = Object.values(msg.data.data)
            let u8ary = new Uint8Array(ary).buffer
            let naltype = ary[3] & 0x1f
            console.log("NALtype=", naltype)
            switch (naltype) {
                case 5:
                    console.log("IDR")
                    break;
                case 1:
                    console.log("non_idr")
                    break;
                case 7:
                    console.log("SPS")
                    break;
                case 8:
                    console.log("PPS")
                    break;
                default:
                    break;
            }

            console.log(msg.data.type)
            chunkinfo = {
                type: msg.data.type,
                timestamp: msg.data.timestamp,
                //data: u8ary,
                data: new Uint8Array(ary),
            }
            console.log("decoding chunk=",chunkinfo)
            __decoder.decode(
                new EncodedVideoChunk(chunkinfo));
            __decoder.flush()

        }
        console.log("gogo")
        /* goto video */
    }
}

__keyframe_received = false;

function wsconnOnOpen(event) {
    wsconnSendGetSession(__wsconn);
}

function wsconnSendGetSession(wsconn) {
    if (wsconn == null) {
        return;
    }

    var msg = {
        type: "get_sessions"
    }
    wsconn.send(JSON.stringify(msg))
}

function wsconnCreateSession(wsconn) {
    if (wsconn == null) {
        return;
    }
    var msg = {
        type: "create_session"
    }
    wsconn.send(JSON.stringify(msg))
}

function wsconnJoinSession(wsconn, id) {
    if (wsconn == null) {
        return;
    }

    var msg = {
        type: "join_session",
        id: id
    }
    wsconn.send(JSON.stringify(msg));
}

function wsconnDeleteSession(wsconn, id) {
    if (wsconn == null) {
        return;
    }

    var msg = {
        type: "delete_session",
        id: id
    }
    wsconn.send(JSON.stringify(msg));

}

function wsconnSendPing(wsconn) {
    var msg = {
        type: "control_data",
        msg: {
            type: "ping",
            time: (performance.now() * 1000).toFixed()
        }
    }

    wsconn.send(JSON.stringify(msg))
}

function get_bytes(str) {
    return(encodeURIComponent(this).replace(/%../g,"x").length);
}

function wsconnSendData(wsconn, data) {
    console.log("wsconnSendData: ", data)
    var msg = {
        type: "data",
        data: data
    }
    console.log("wsconnSendData: mst", msg)
    wsconn.send(JSON.stringify(msg))
}


document.getElementById("button_ws_url").onclick = function () {
    __url = document.getElementById("text_ws_url").value;
    console.log(__url);
    __wsconn = new WebSocket(__url);
    __wsconn.onopen = wsconnOnOpen;
    __wsconn.onmessage = wsconnOnMessage;
}

document.getElementById("button_sessions_join").onclick = function () {
    selects = document.getElementById("select_sessions");
    selected_idx = selects.selectedIndex;
    selected_id = selects.options[selected_idx].value;
    wsconnJoinSession(__wsconn, selected_id);
}

document.getElementById("button_sessions_create").onclick = function () {
    wsconnCreateSession(__wsconn)
}

document.getElementById("button_sessions_renew").onclick = function () {
    wsconnSendGetSession(__wsconn);
}

document.getElementById("button_sessions_delete").onclick = function () {
    selects = document.getElementById("select_sessions");
    selected_idx = selects.selectedIndex;
    selected_id = selects.options[selected_idx].value;
    wsconnDeleteSession(__wsconn, selected_id);
}

document.getElementById("button_send_ping").onclick = function () {
    wsconnSendPing(__wsconn)
}

document.getElementById("button_activate_sender").onclick = function () {
    /*
    devices = navigator.mediaDevices.enumerateDevices().then(devices => {
        console.log(devices);
        videoDevices = devices.filter(device => device.kind === "videoinput");
        console.log(videoDevices);

        videoDevices.forEach(device => {
            deviceId = device.
            v = document.createElement("video");
            v.srcObject = device.stre

        })


    })
    */

    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        [videoTrack] = stream.getVideoTracks();
        v = document.createElement("video")
        v.srcObject = stream;
        v.width = "640";
        v.autoplay = true;
        document.getElementById("div_sender_video").appendChild(v)

        init = {
            output: handleChunk,
            error: (e) => {
                console.log("videoencoder error: " + e.message);
            },
        };

        const config = {
            //codec: "avc1.64001E",
            codec: "vp8",
            width: 640,
            height: 480,
            bitrate: 2_000_000,
            framerate: 30,
        };

        encoder = new VideoEncoder(init);
        encoder.configure(config);

        processor = new MediaStreamTrackProcessor(videoTrack);
        frameReader = processor.readable.getReader();
        frameCounter = 0;
        reader = async () => {
            while (true) {
                result = await frameReader.read();
                if (result.done) {
                    console.log("video done");
                    break;
                }

                frame = result.value;
                //console.log(frame)
                if (encoder.encodeQueueSize > 2) {
                    console.log("too many frame in flight");
                    frame.close();
                } else {
                    frameCounter++;
                    keyframe = frameCounter % 30 == 0;
                    keyframe = true
                    console.log("keyframe = " + keyframe + " " + frameCounter);
                    encoder.encode(frame, { keyFrame: keyframe })
                    frame.close(9)
                }
            }
        }
        reader();
    }).catch(error => {
        console.log("sender activateion failed :" + error);;
    });
}

function handleChunk(chunk, metadata) {
    //console.log("chunk " + chunk)
    //console.log("metadata" + metadata);
    console.log(typeof(chunk))
    console.log("chunk = ", chunk)
    const chunkData = new Uint8Array(chunk.byteLength);
    chunk.copyTo(chunkData);
    console.log("config = ", metadata.decoderConfig)

    chunkInfo = {
        type: chunk.type,
        timestamp: chunk.timestamp,
        data: chunkData
    }

    wsconnSendData(__wsconn, chunkInfo);
}

var __decoder = null;

document.getElementById("button_activate_receiver").onclick = function () {
    console.log("activate receiver")
    init = {
        output: handleReceivedFrame,
        error: (error) => {
            console.log("decode error " + error)
        }
    }
    config = {
        //codec: "avc1.64001E",
        codec: "vp8",
        codedWidth: 640,
        codedHeight: 480,
    }

    __decoder = new VideoDecoder(init);
    __decoder.configure(config)
}

function handleReceivedFrame(frame) {
    var canvas = document.getElementById("canvas");
    canvas.width = frame.codedWidth
    canvas.height = frame.codedHeight
    context = canvas.getContext('2d')
    context.drawImage(frame, 0, 0)
    frame.close()
}