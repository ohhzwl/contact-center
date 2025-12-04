import './static/adapter.min.js';
import Janus from './static/janus.js';
// 1. 导入 worker 文件内容为字符串
import workerCode from './static/worker-module.js?raw'; // ?raw 表示作为字符串导入
// 2. 创建 Blob URL
const blob = new Blob([workerCode], {type: 'application/javascript'});
const workerUrl = URL.createObjectURL(blob);
// 3. 创建 Worker
const worker = new Worker(workerUrl);


let v9Data = {
    loginData: {
        agentId: '',
        agentKey: '',
        companyId: '',
        companyCode: '',
        agentType: '',
        token: '',
        wsServer: '',
        webrtcServer: '',
        ossServer: '',
        sipServer: '',
        agentCode: '',
        sipPwd: '',
        groupId: '',
        groupIds: [],
        version: '',
        sdkVersion: '2.4.0',
    },
    wsUrl: '',
    socket: '',

    // ws的callId
    callId: null,
    conference: null,
    conferenceList: [],
    code: 0,
    callType: null,
    //记录重连的状态
    reconnectState: null,
    //自定义类型
    busyDesc: null,

    janus: null,
    sipcall: null,

    stream: null,
    //状态枚举
    statusObject: {
        LOGIN: {
            text: '已登录',
            color: '#0d6efd',
            showBtn: ['phoneOutcall']
        },
        LOGOUT: {
            text: '已退出',
            color: '#0d6efd',
            showBtn: []
        },
        READY: {
            text: '空闲',
            color: '#0d6efd',
            showBtn: ['phoneOutcall']
        },
        NOT_READY: {
            text: '忙碌',
            color: '#EA9738',
            showBtn: ['phoneOutcall']
        },
        WORK_NOT_READY: {
            text: '自定义',
            color: '#EA9738',
            showBtn: ['phoneOutcall']
        },
        AFTER: {
            text: '话后',
            color: '#0d6efd',
            showBtn: ['phoneOutcall']
        },
        OUT_CALL: {
            text: '外呼中',
            color: '#18bc9c',
            showBtn: ['phoneHangup']
        },
        OUT_CALLER_RING: {
            text: '外呼主叫振铃',
            color: '#18bc9c',
            showBtn: ['phoneAnswer', 'phoneHangup']
        },
        OUT_CALLED_RING: {
            text: '外呼被叫振铃',
            color: '#18bc9c',
            showBtn: ['phoneHangup']
        },
        PLAY_AGENT_ID: {
            text: '播放坐席工号',
            color: '#18bc9c',
            showBtn: ['phoneHangup']
        },
        TALKING: {
            text: '通话中',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phonehold', 'phoneMute', 'phoneTransfer', 'phoneConsult']
        },
        MUTE_TALKING: {
            text: '静音中',
            color: '#18bc9c',
            showBtn: ['phoneCancelMute']
        },
        HOLD_TALKING: {
            text: '保持',
            color: '#18bc9c',
            showBtn: ['phoneCancelhold']
        },
        INNER_CALL_RING: {
            text: '内呼来电振铃',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneAnswer']
        },
        INNER_CALL_TALKING: {
            text: '内呼通话中',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneMute']
        },
        INBOUND_RING: {
            text: '来电振铃',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneAnswer']
        },
        TRANSFER: {
            text: '转接中',
            color: '#18bc9c',
            showBtn: ['phoneCancelTransfer']
        },
        TRANSFERED_RING: {
            text: '转接来电振铃',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneAnswer']
        },
        TRANSFER_OUT_RING: {
            text: '转接外呼振铃',
            color: '#18bc9c',
            showBtn: ['phoneCancelTransfer']
        },
        TRANSFERED_TALKING: {
            text: '转接来电通话中',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneMute', 'phoneTransfer', 'phoneConsult']
        },
        CONSULT: {
            text: '咨询中',
            color: '#18bc9c',
            showBtn: ['phoneCancelConsult']
        },
        CONSULT_RING: {
            text: '咨询来电振铃',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneAnswer']
        },
        CONSULT_OUT_RING: {
            text: '咨询外呼振铃',
            color: '#18bc9c',
            showBtn: ['phoneCancelConsult']
        },
        CONSULT_IVR: {
            text: '咨询IVR',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneCancelConsult']
        },
        CONSULT_TALKING: {
            text: '咨询通话中',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneMute', 'phoneCancelConsult', 'phoneConsultParty', 'phoneTransfer2']
        },
        CONSULTED_TALKING: {
            text: '来电咨询中',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneMute']
        },
        CONFERENCE_TALKING: {
            text: '多方通话',
            color: '#18bc9c',
            showBtn: ['phoneHangup', 'phoneMute', 'phoneConsult']
        }
    },
    //定义初始状态
    status: 'LOGIN',

    statusDropList: [{
        text: '空闲', type: 'READY'
    }, {
        text: '忙碌', type: 'NOT_READY'
    },], logoutDropList: [{
        text: '登出', type: 'LOGOUT',
    },],

    timers: {
        callTimer: 0, callTimerStr: '00:00:00', callTimerInterval: null,
    },

    telNum: '', telNumTransfer: '', telNumConsult: '', shrink: false,

    //webrtc会话
    acceptMsg: "",
    acceptJsep: "",

    activeCallId: null,

    // 重新连接定时器
    reconectInterval: null,
    // 话后定时器
    afterPhoneInterval: null,
}

let events = {}

let v9 = {

    addAudio() {
        let audio = document.createElement('audio')
        audio.id = 'incomingcallAudio';
        audio.loop = true;
        audio.src = v9Data.loginData.ossServer + '/fs-api/beep.wav';
        audio.style.display = 'none';
        document.body.appendChild(audio);

        let peerVideo = document.createElement('video');
        peerVideo.id = 'peerVideo';
        peerVideo.autoplay = true;
        peerVideo.style.display = 'none';
        document.body.appendChild(peerVideo);

        let remoteVideo = document.createElement('video');
        remoteVideo.id = 'remoteVideo';
        remoteVideo.autoplay = true;
        remoteVideo.style.display = 'none';
        document.body.appendChild(remoteVideo);
    },
    videoControll(type = true) {
        let incomingcallAudio = document.getElementById('incomingcallAudio')
        if (type) {
            incomingcallAudio.play()
        } else {
            incomingcallAudio.pause()
        }
    },
    connectWs() {
        v9Data.wsUrl = `${v9Data.loginData.wsServer}?token=${v9Data.loginData.token}`
        console.log("[" + v9.dateLog() + "] " + 'websocket url:' + v9Data.wsUrl);
        if (!window.WebSocket) {
            alert('您的浏览器不支持WebSocket协议！')
            return
        }
        v9Data.socket = worker;
        let login = {
            cmd: 'LOGIN',
            agentKey: v9Data.loginData.agentKey,
            loginType: v9Data.loginData.loginType,
            workType: v9Data.loginData.workType,
            version: v9Data.loginData.version,
            sdkVersion: v9Data.loginData.sdkVersion,
            sequence: new Date().getTime(),
        };
        // 重连时传递参数
        if (v9Data.status && v9Data.status.includes('TALKING')) {
            login.callId = v9Data.callId
        }

        worker.postMessage({
            action: 'INIT_WS',
            wsUrl: v9Data.wsUrl,
            agentKey: v9Data.loginData.agentKey
        });

        // 监听 Worker 消息
        worker.onmessage = (event) => {
            const {type, payload} = event.data;
            switch (type) {
                case 'ON_OPEN':
                    window.clearInterval(v9Data.reconectInterval);
                    worker.postMessage({action: 'SEND_MESSAGE', data: JSON.stringify(login)});
                    break;
                case 'ON_MESSAGE':
                    try {
                        const data = JSON.parse(payload);
                        //通知调用方
                        v9.onmessage(data)
                        const statusEnum = v9Data.statusObject[data.type];
                        if (statusEnum === null || statusEnum === undefined) {
                            return;
                        }
                        //code为0时，更变之前状态
                        if (data.code === 0) {
                            v9Data.status = data.type;
                        }
                        v9Data.code = data.code
                        v9Data.callType = data.data && data.data.callType
                        //根据状态处理函数
                        v9.statusChangeFun(data)

                        // 错误给出提示信息
                        if (data.code !== 0) {
                            debugger
                        }
                    } catch (err) {
                        console.error(err);
                    }
                    break
                case 'ON_CLOSE':
                    try {
                        // 清理重新连接定时器
                        window.clearInterval(v9Data.reconectInterval);

                        const notReconectStatus = [
                            1403, //坐席在别处登录
                            1105, //账号未登录
                            1417, //坐席被强制下线
                        ]
                        //断开回调
                        v9.trigger("logout", v9Data.code);
                        if (v9Data.loginData.loginType === 2) {
                            window.janus.destroy && window.janus.destroy()
                        }

                        if (notReconectStatus.includes(v9Data.code)) {
                            return;
                        }
                        //重新连接
                        v9Data.reconectInterval = setInterval(() => {
                            if (v9Data.loginData.loginType === 2) {
                                window.janus.destroy && window.janus.destroy();
                            }
                            v9.connectWs()
                        }, 5000);
                    } catch (e) {
                        console.error(e);
                    }
                    break
            }
        };
    },
    statusChangeFun(data) {
        let {
            type, message
        } = data

        let dataResponse = data.data
        if (dataResponse && dataResponse.callId) {
            v9Data.callId = dataResponse.callId
        }
        if (dataResponse && dataResponse.conference) {
            v9Data.conference = dataResponse.conference
        }

        // 转多方会议，参会人
        if (dataResponse && dataResponse.conferenceList) {
            v9Data.conferenceList = dataResponse.conferenceList
        } else {
            v9Data.conferenceList = []
        }

        // 登录
        if (type === 'LOGIN') {
            // 登录方式为webrtc时，初始化janus
            if (v9Data.loginData.loginType === 2 && v9Data.code === 0) {
                v9.initJanus();
            }
            // 登陆之后根据返回的loginState设置状态
            if (v9Data.reconnectState == null) {
                //第一次登录
                v9.sendAction(dataResponse.loginState);
            } else {
                //ws重连登录
                v9.sendAction(v9Data.reconnectState);
            }
        } else if (type === 'AFTER') {
            v9Data.status = 'AFTER';
            //如果是loginType=2,通话未接通,重新注册webrtc
            if (data.code === 0 && dataResponse.loginType === 2 && dataResponse.answerTime === 0) {
                if ('404' === dataResponse.sipStatus || '483' === dataResponse.sipStatus) {
                    this.initJanus();
                }
            }

            //话后自动空闲时间根据after中data返回
            if (dataResponse == null || dataResponse.afterInterval === 0) {
                return;
            }
            v9Data.afterPhoneInterval = setTimeout(() => {
                if (v9Data.status !== 'AFTER') {
                    return;
                }
                console.log("[" + v9.dateLog() + "] 话后自动置闲");
                v9.sendAction('READY');
            }, dataResponse.afterInterval * 1000);
        } else if (type === 'OUT_CALL') {
            // 通话
            if (message) {
                // this.$toast.open({
                //   message: message,
                //   type: 'error',
                //   position: 'bottom',
                // })
            }
        } else if (type === 'READY' || type === 'NOT_READY') {
            //空闲或忙碌
            v9Data.reconnectState = type;
        } else if (type === 'WORK_NOT_READY') {
            //自定义忙碌
            v9Data.reconnectState = type;
            //如果处于自定义忙碌状态ws断开重连，需要携带当前的busyDesc
            v9Data.busyDesc = dataResponse.busyDesc;
        }
    },
    initJanus() {
        let loginData = v9Data.loginData
        if (loginData.sipServer === '' || loginData.webrtcServer === '') {
            return
        }

        let localTracks = {}, localVideos = 0, remoteTracks = {}

        let registered = false
        // eslint-disable-next-line no-unused-vars
        let masterId = null
        let incoming = null

        let janus = Janus
        v9Data.janus = janus
        janus.init({
            debug: 'all', callback: function () {
                // Make sure the browser supports WebRTC
                // let protocol = window.location.protocol
                let protocol = 'https:'
                if (!janus.isWebrtcSupported() || protocol !== 'https:') {
                    console.info('No WebRTC support... ')
                    return
                }

                // Create session
                v9Data.janus = new janus({
                    server: v9Data.loginData.webrtcServer, success: function () {
                        janus.attach({
                            plugin: 'janus.plugin.sip',
                            opaqueId: 'voice9_' + janus.randomString(16),
                            success: function (pluginHandle) {
                                v9Data.sipcall = pluginHandle
                                janus.log('Plugin attached! (' + v9Data.sipcall.getPlugin() + ', id=' + v9Data.sipcall.getId() + ')')
                                // Prepare the username registration
                                let register = {
                                    request: 'register',
                                    username: 'sip:' + loginData.agentCode + '@' + loginData.sipServer,
                                    authuser: loginData.agentCode,
                                    // display_name: loginData.agentCode,
                                    secret: loginData.sipPwd,
                                    proxy: 'sip:' + loginData.agentCode + '@' + loginData.sipServer,
                                }
                                v9Data.sipcall.send({
                                    message: register
                                })
                            },
                            error: function (error) {
                                janus.error('  -- Error attaching plugin...', error)
                            },
                            consentDialog: function (on) {
                                janus.debug('Consent dialog should be ' + (on ? 'on' : 'off') + ' now')
                            },
                            webrtcTimeout: function (a) {
                                janus.error('webrtcTimeout', a);
                                v9.initJanus();
                            },
                            iceState: function (state) {
                                janus.log('ICE state changed to ' + state)
                            },
                            mediaState: function (medium, on, mid) {
                                janus.log('janus ' + (on ? 'started' : 'stopped') + ' receiving our ' + medium + ' (mid=' + mid + ')')
                            },
                            webrtcState: function (on) {
                                janus.log('janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now')
                            },
                            slowLink: function (uplink, lost, mid) {
                                janus.warn('janus reports problems ' + (uplink ? 'sending' : 'receiving') + ' packets on mid ' + mid + ' (' + lost + ' lost packets)')
                            },
                            onmessage: function (msg, jsep) {
                                janus.debug(' ::: Got a message :::', msg)
                                let callId = msg['call_id']
                                let result = msg['result']
                                if (result && result['event']) {
                                    let event = result['event']
                                    if (event === 'registration_failed') {
                                        janus.warn('Registration failed: ' + result['code'] + ' ' + result['reason'])
                                        return
                                    }
                                    if (event === 'registered') {
                                        const username = result['username'];
                                        console.log("[" + v9.dateLog() + "] " + username + ' registered webrtc successfully');
                                        // TODO Enable buttons to call now
                                        if (!registered) {
                                            registered = true;
                                            masterId = result['master_id'];
                                            //通知回调
                                            v9.onmessage({"type": "registered", "sipAccount": +username, "code": 0});
                                        }
                                    } else if (event === 'calling') {
                                        janus.log('Waiting for the peer to answer...')
                                        // TODO Any ringtone?
                                    } else if (event === 'incomingcall') {
                                        janus.log('Incoming call from ' + result['username'] + '!')
                                        v9Data.sipcall.callId = callId

                                        // 播放铃声
                                        v9.videoControll(true)

                                        // 手动拼accept需要的参数
                                        v9Data.acceptMsg = msg;
                                        v9Data.acceptJsep = jsep;

                                        //自动接听
                                        if (v9Data.loginData.loginType === 2) {
                                            if (v9Data.loginData.workType === 2 || v9Data.status === 'OUT_CALL' || v9Data.status === 'OUT_CALLER_RING') {
                                                v9.accept(msg, jsep);
                                            }
                                        }

                                    } else if (event === 'accepting') {
                                        // Response to an offerless INVITE, let's wait for an 'accepted'
                                    } else if (event === 'progress') {
                                        janus.log("There's early media from " + result['username'] + ', wairing for the call!', jsep)
                                        if (jsep) {
                                            v9Data.sipcall.handleRemoteJsep({
                                                jsep: jsep, //error: doHangup,
                                            })
                                        }
                                    } else if (event === 'accepted') {
                                        janus.log(result['username'] + ' accepted the call!', jsep)
                                        v9.videoControll(false);
                                        // Call can start, now: handle the remote answer
                                        if (jsep) {
                                            v9Data.sipcall.handleRemoteJsep({
                                                jsep: jsep, //error: doHangup,
                                            })
                                        }
                                        v9Data.sipcall.callId = callId
                                    } else if (event === 'updatingcall') {
                                        janus.log('Got re-INVITE')
                                        let doAudio = jsep.sdp.indexOf('m=audio ') > -1,
                                            doVideo = jsep.sdp.indexOf('m=video ') > -1
                                        // We want bidirectional audio and/or video, but only
                                        // populate tracks if we weren't sending something before
                                        let tracks = []
                                        if (doAudio && !v9Data.sipcall.doAudio) {
                                            v9Data.sipcall.doAudio = true
                                            tracks.push({
                                                type: 'audio', capture: true, recv: true,
                                            })
                                        }
                                        if (doVideo && !v9Data.sipcall.doVideo) {
                                            v9Data.sipcall.doVideo = true
                                            tracks.push({
                                                type: 'video', capture: true, recv: true,
                                            })
                                        }
                                        v9Data.sipcall.createAnswer({
                                            jsep: jsep, tracks: tracks, success: function (jsep) {
                                                janus.debug('Got SDP ' + jsep.type + '! audio=' + doAudio + ', video=' + doVideo + ':', jsep)
                                                let body = {
                                                    request: 'update'
                                                }
                                                v9Data.sipcall.send({
                                                    message: body, jsep: jsep
                                                })
                                            }, error: function (error) {
                                                janus.error('WebRTC error:', error)
                                            },
                                        })
                                    } else if (event === 'message') {
                                        // We got a MESSAGE
                                        let sender = result['displayname'] ? result['displayname'] : result['sender']
                                        let content = result['content']
                                        console.info('sender = ' + sender)
                                        console.info('content = ' + content)
                                    } else if (event === 'info') {
                                        // We got an INFO
                                        let sender = result['displayname'] ? result['displayname'] : result['sender']
                                        let content = result['content']
                                        content = content.replace(new RegExp('<', 'g'), '&lt')
                                        content = content.replace(new RegExp('>', 'g'), '&gt')
                                        console.log("[" + v9.dateLog() + "] sender = " + sender + ", content = " + content);
                                    } else if (event === 'notify') {
                                        //let notify = result['notify']
                                        //let content = result['content']
                                    } else if (event === 'transfer') {
                                        /**
                                         let referTo = result['refer_to']
                                         let referredBy = result['referred_by']
                                         ? result['referred_by']
                                         : 'an unknown party'
                                         let referId = result['refer_id']
                                         let replaces = result['replaces']
                                         let extra = 'referred by ' + referredBy
                                         if (replaces) extra += ', replaces call-ID ' + replaces
                                         extra = extra.replace(new RegExp('<', 'g'), '&lt')
                                         extra = extra.replace(new RegExp('>', 'g'), '&gt')
                                         */
                                    } else if (event === 'hangup') {
                                        if (incoming != null) {
                                            incoming.modal('hide')
                                            incoming = null
                                        }
                                        janus.log('Call hung up (' + result['code'] + ' ' + result['reason'] + ')!')
                                        v9.videoControll(false);
                                        // Reset status
                                        v9Data.sipcall.hangup()
                                    } else if (event === 'messagedelivery') {
                                        // message delivery status
                                        /**
                                         let reason = result['reason']
                                         let code = result['code']
                                         let callid = msg['call_id']
                                         if (code == 200) {
                                         //toastr.success(`${callid} Delivery Status: ${code} ${reason}`);
                                         } else {
                                         //toastr.error(`${callid} Delivery Status: ${code} ${reason}`);
                                         }
                                         */
                                    }
                                }
                            },
                            onlocaltrack: function (track, on) {
                                janus.log('Local track ' + (on ? 'added' : 'removed') + ':', track)
                                // We use the track ID as name of the element, but it may contain invalid characters
                                let trackId = track.id.replace(/[{}]/g, '')
                                if (!on) {
                                    // Track removed, get rid of the stream and the rendering
                                    v9Data.stream = localTracks[trackId]
                                    if (v9Data.stream) {
                                        try {
                                            let tracks = v9Data.stream.getTracks()
                                            for (let i in tracks) {
                                                let mst = tracks[i]
                                                if (mst) mst.stop()
                                            }
                                        } catch (e) {
                                            console.error(e)
                                        }
                                    }
                                    if (track.kind === 'video') {
                                        localVideos--
                                        if (localVideos === 0) {
                                            console.log('No video')
                                        }
                                    }
                                    delete localTracks[trackId]
                                    return
                                }
                                // If we're here, a new track was added
                                v9Data.stream = localTracks[trackId]
                                if (v9Data.stream) {
                                    // We've been here already
                                    return
                                }

                                if (track.kind === 'audio') {
                                    // We ignore local audio tracks, they'd generate echo anyway
                                } else {
                                    // New video track: create a stream out of it
                                    localVideos++
                                    v9Data.stream = new MediaStream([track])
                                    localTracks[trackId] = v9Data.stream
                                    janus.log('Created local stream:', v9Data.stream)
                                    let remoteVideo = document.getElementById('remoteVideo')
                                    janus.attachMediaStream(remoteVideo, v9Data.stream)
                                }
                                if (v9Data.sipcall.webrtcStuff.pc.iceConnectionState !== 'completed' && v9Data.sipcall.webrtcStuff.pc.iceConnectionState !== 'connected') {
                                    // eslint-disable-next-line no-debugger
                                    // debugger
                                }
                            },
                            onremotetrack: function (track, mid, on) {
                                janus.log('Remote track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track)
                                if (!on) {
                                    return
                                }
                                if (track.kind === 'audio') {
                                    // New audio track: create a stream out of it, and use a hidden <audio> element
                                    v9Data.stream = new MediaStream([track])
                                    remoteTracks[mid] = v9Data.stream
                                    janus.log('Created remote audio stream:', v9Data.stream)

                                    let peerVideo = document.getElementById('peerVideo')
                                    janus.attachMediaStream(peerVideo, v9Data.stream)
                                }
                            },
                            oncleanup: function () {
                                janus.log(' ::: Got a cleanup notification :::')
                                if (v9Data.sipcall) {
                                    delete v9Data.sipcall.callId
                                    delete v9Data.sipcall.doAudio
                                }
                                localTracks = {}
                                localVideos = 0
                                remoteTracks = {}
                            },
                        })
                    }, error: function (error) {
                        janus.error(error)
                    }, destroyed: function () {
                        console.info('destroyed===========')
                    },
                })

                window.janus = janus

            },
        })
    },
    //janus消息处理
    accept(msg, jsep) {
        if (v9Data.loginData.loginType === 1) {
            v9.echo(`{"cmd":"ANSWER","callId":${v9Data.callId},"agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
            return;
        }
        let offerlessInvite = false
        let doAudio = true
        let sipcallAction = offerlessInvite ? v9Data.sipcall.createOffer : v9Data.sipcall.createAnswer
        sipcallAction({
            jsep: jsep, media: {
                audio: doAudio, video: false
            }, success: function (jsep) {
                let body = {
                    request: 'accept'
                }
                v9Data.sipcall.send({
                    message: body, jsep: jsep
                })
            }, error: function (error) {
                v9Data.janus.error('WebRTC error:', error)
                let body = {
                    request: 'decline', code: 480
                }
                v9Data.sipcall.send({
                    message: body
                })
            },
        })
    },
    // 带token的websocket通信
    echo(message) {
        let socket = v9Data.socket
        if (socket != null) {
            //console.log("[" + v9.dateLog() + "] sent: " + message)
            //socket.send(message)
            socket.postMessage({action: 'SEND_MESSAGE', data: message});
        } else {
            alert('WebSocket connection not established, please connect.')
        }
    },
    // 通话后修改状态
    changeStatus(type) {
        v9.echo(`{"cmd":"${type}", "agentKey": "${v9Data.loginData.agentKey}", "sequence": ${new Date().getTime()} }`);
        //清除话后修改状态定时器
        window.clearInterval(v9Data.afterPhoneInterval);
    },
    //sdk发起动作
    sendAction(type) {
        if (type === 'MAKE_CALL') {
            window.clearInterval(v9Data.afterPhoneInterval);
            v9.echo(`{"cmd":"${type}", "agentKey":"${v9Data.loginData.agentKey}" ,"sequence":${new Date().getTime()}, "display":"", "called":"${v9Data.telNum}", "callType":2, "followData":{}}`);
            return;
        }
        if (type === 'TRANSFER') {
            // 路由类型(1:转技能组,2:转ivr,3:转坐席,4:转外呼,5:放音,6:按键收号,7:vdn,8:转sip,9:转机器人)
            let transferType = '4';
            if (v9Data.telNumTransfer.endsWith('@' + v9Data.loginData.companyCode)) {
                transferType = '3';
            } else if (v9Data.telNumTransfer.startsWith('groupId:')) {
                transferType = '1';
            } else if (v9Data.telNumTransfer.startsWith('ivrId:')) {
                transferType = '2';
            }
            v9.echo(`{"cmd":"${type}", "agentKey":"${v9Data.loginData.agentKey}", "callId":${v9Data.callId}, "transferType":"${transferType}", "transferValue":"${v9Data.telNumTransfer}", "sequence":${new Date().getTime()}}`);
            return;
        }

        if (type === 'CONSULT') {
            //咨询类型 1:咨询技能组,2:咨询ivr,3:播放导航音,4:咨询坐席,5:咨询外呼,6:咨询sip
            let inLine = v9Data.telNumConsult.includes('@');
            let transferType = '2';
            if (inLine) {
                transferType = '4';
            }
            v9.echo(`{"cmd":"${type}","sequence":${new Date().getTime()}, "consultType":"${transferType}", "consultValue":"${v9Data.telNumConsult}"}`);
            return;
        }

        if (type === 'CONSULT_CANCEL') {
            v9.echo(`{"cmd":"${type}", "agentKey":"${v9Data.loginData.agentKey}","sequence": ${new Date().getTime()} }`);
            return;
        }
        //转多方
        if (type === 'CONSULT_PARTY') {
            v9.echo(`{"cmd":"${type}","callId":${v9Data.callId},"agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
            return;
        }
        //咨询转接
        if (type === 'CONSULT_TRANSFER') {
            v9.echo(`{"cmd":"${type}","callId":${v9Data.callId},"agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
            return;
        }
        //自定义忙碌
        if (type === 'WORK_NOT_READY') {
            v9.echo(`{"cmd":"${type}", "busyDesc":"${v9Data.busyDesc}" ,"callId":${v9Data.callId},"agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
            return;
        }
        v9.echo(`{"cmd":"${type}", "agentKey":"${v9Data.loginData.agentKey}", "sequence":${new Date().getTime()} }`);
    },
    //会议
    removeRoomFun(item) {
        v9.echo(`{"cmd":"CONFERENCE_REMOVE", "callId":${item.callId}, "deviceId":"${item.deviceId}", "conference":"${v9Data.conference}", "memberId":${item.memberId}, "username":${item.username}}`);
    },

    //触发器
    trigger(eventName, data) {
        if (events[eventName]) {
            events[eventName].forEach(callback => {
                callback(data);
            });
        }
    },
    //接受消息
    onmessage(data) {
        v9.trigger('message', data)
    },
    //时间日志
    dateLog() {
        var date = new Date();
        var y = date.getFullYear();
        var m = date.getMonth() + 1;
        var d = date.getDate();
        var h = date.getHours();
        var mm = date.getMinutes();
        var s = date.getSeconds();
        var sss = date.getMilliseconds();
        if (m < 10) {
            m = "0" + m;
        }
        if (d < 10) {
            d = "0" + d;
        }
        if (h < 10) {
            h = "0" + h;
        }
        if (mm < 10) {
            mm = "0" + mm;
        }
        if (s < 10) {
            s = "0" + s;
        }
        if (sss < 10) {
            sss = sss + "00";
        } else if (sss < 100) {
            sss = sss + "0";
        }
        return y + "-" + m + "-" + d + " " + h + ":" + mm + ":" + s + "." + sss;
    }
}

function Voice9() {
    this.init = function (data) {
        v9Data.loginData = {
            ...v9Data.loginData, ...data
        };
        console.log("[" + v9.dateLog() + "] voice9 init", data);

        v9.connectWs();
        v9.addAudio()
    }
    this.logout = function () {
        //设置状态不重连
        v9Data.code = 1105;
        //主动断开时，重连状态设置为空
        v9Data.reconnectState = null;
        // 断开websocket
        v9.changeStatus('LOGOUT')
        // 断开janus
        if (v9Data.loginData.loginType === 2) {
            window.janus.destroy && window.janus.destroy()
        }
    }
    //示忙(废弃)
    this.setBusy = function () {
        v9.changeStatus('NOT_READY')
    }
    //示闲
    this.setReady = function () {
        v9.changeStatus('READY')
    }
    //示闲
    this.setNotReady = function () {
        v9.changeStatus('NOT_READY')
    }
    //自定义忙碌
    this.setWorkNotReady = function (busyDesc) {
        v9.echo(`{"cmd":"WORK_NOT_READY", "busyDesc":"${busyDesc}", "agentKey": "${v9Data.loginData.agentKey}", "sequence": ${new Date().getTime()} }`);
    }
    //发起呼叫
    this.makeCall = function (telNum) {
        v9Data.telNum = telNum;
        v9Data.status = "OUT_CALL";
        v9.sendAction('MAKE_CALL')
    }
    //带随路数据拨打
    this.makeCallByFollowData = function (telNum, followData) {
        window.clearInterval(v9Data.afterPhoneInterval);
        v9Data.status = "OUT_CALL";
        v9.echo(`{"cmd":"MAKE_CALL", "agentKey":"${v9Data.loginData.agentKey}" ,"sequence":${new Date().getTime()}, "display":"", "called":"${telNum}", "callType":2, "followData":${followData} }`);
    }
    //应答
    this.acceptCall = function () {
        v9.accept(v9Data.acceptMsg, v9Data.acceptJsep)
    }
    //发送dtmf按键
    this.sendDtmf = function (dtmf) {
        v9.echo(`{"cmd":"DTMF","dtmf":"${dtmf}","callId":${v9Data.callId},"agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
    }
    //对方开启视频
    this.startVideo = function () {
        v9.echo(`{"cmd":"START_VIDEO", "":${v9Data.callId}, "agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()}  }`);
    }

    //自己开启视频

    //挂机
    this.hangupCall = function () {
        v9.sendAction('HANGUP_CALL')
    }
    //转接
    this.phoneTransfer = function (telNum) {
        v9Data.telNumTransfer = telNum
        v9.sendAction('TRANSFER')
    }
    //咨询
    this.phoneConsult = function (telNum) {
        v9Data.telNumConsult = telNum
        v9.sendAction('CONSULT')
    }
    //取消咨询
    this.phoneConsultCancel = function () {
        v9.sendAction('CONSULT_CANCEL')
    }
    //结束咨询
    this.phoneConsultStop = function () {
        v9.sendAction('CONSULT_STOP')
    }
    //咨询转接
    this.phoneConsultTransfer = function (telNum) {
        v9Data.telNumTransfer = telNum
        v9.sendAction('CONSULT_TRANSFER')
    }
    //转会议
    this.phoneConsultParty = function () {
        v9.sendAction('CONSULT_PARTY')
    }
    //从会议中移除
    this.conferenceRemove = function (item) {
        v9.echo(`{"cmd":"CONFERENCE_REMOVE", "callId":${item.callId}, "deviceId":"${item.deviceId}", "conference":"${v9Data.conference}", "memberId":${item.memberId}, "username":${item.username}}`);
    }

    //静音
    this.mutePhone = function () {
        v9.sendAction('MUTE')
    }
    //取消静音
    this.muteCancel = function () {
        v9.sendAction('MUTE_CANCEL')
    }
    //保持
    this.holdTalking = function () {
        v9.sendAction('HOLD')
    }
    //取消保持
    this.holdCancel = function () {
        v9.sendAction('HOLD_CANCEL')
    }
    //监听
    this.monitorCall = function (monitorAgent, callId) {
        v9Data.status = "OUT_CALL";
        v9.echo(`{"cmd":"MONITOR_CALL","callId":${callId},"agentKey":"${v9Data.loginData.agentKey}","monitorAgent":"${monitorAgent}","sequence":${new Date().getTime()} }`);
    }

    //强拆(必须处于监听中)
    this.interceptCall = function () {
        v9Data.status = "OUT_CALL";
        v9.echo(`{"cmd":"INTERCEPT_CALL","agentKey":"${v9Data.loginData.agentKey}","sequence":${new Date().getTime()} }`);
    }

    //强插
    this.bargeCall = function (monitorAgent, callId) {
        v9Data.status = "OUT_CALL";
        v9.echo(`{"cmd":"BARGE_CALL","callId":${callId},"agentKey":"${v9Data.loginData.agentKey}","monitorAgent":"${monitorAgent}","sequence":${new Date().getTime()} }`);
    }

    //辅导
    this.coachCall = function (monitorAgent, callId) {
        v9Data.status = "OUT_CALL";
        v9.echo(`{"cmd":"COACH_CALL","callId":${callId},"agentKey":"${v9Data.loginData.agentKey}","monitorAgent":"${monitorAgent}","sequence":${new Date().getTime()} }`);
    }

    //更新随路数据
    this.updateCallFollowData = function (followData, uuid1, uuid2, ext1, ext2, ext3, ext4, ext5) {
        v9.echo(`{"cmd":"UPDATE_FOLLOWDATA", "agentKey":"${v9Data.loginData.agentKey}","callId":${v9Data.callId}, "followData":${followData}, "uuid1":"${uuid1}", "uuid2":"${uuid2}","ext1":"${ext1}","ext2":"${ext2}","ext3":"${ext3}","ext4":"${ext4}","ext5":"${ext5}","sequence":${new Date().getTime()}}`);
    }

    //自定义消息
    this.customMessage = function (msg) {
        v9.echo(msg);
    }

    this.on = function (eventName, callback) {
        if (!events[eventName]) {
            events[eventName] = [];
        }
        events[eventName].push(callback);
    }
    this.addEventListener = function (eventName, callback) {
        if (!events[eventName]) {
            events[eventName] = [];
        }
        events[eventName].push(callback);
    }
    this.off = function (event, callback) {
        if (!events[event]) return callback('事件不存在');
        delete events[event];
        callback('事件删除成功');
    }
}

export default Voice9
