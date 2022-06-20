import '../../shim.js';
import {
    ModelBuilder,
    DataObject,
    CallbackNode,
    DataSerializer,
    Model,
    AbsolutePosition,
    DataFrame,
    TimeUnit,
    TimedPullNode,
    FrameMergeNode
} from '@openhps/core';
import {BLESourceNode, WLANSourceNode, IMUSourceNode, SensorType } from '@openhps/react-native';
import DeviceInfo from 'react-native-device-info';
import { SocketClient, SocketClientSink } from '@openhps/socket';
import { self } from 'react-native-threads';
import BLESourceNode2 from './BLESourceNode2';

// Uniquely identify the device
const phoneUID = DeviceInfo.getUniqueId();

let recording: boolean = false;
let position: AbsolutePosition = undefined;
let model: Model;

self.postMessage(JSON.stringify({
    event: 'log',
    args: ["info", "Thread is started!"]
}));

self.onmessage = (message: string) => {
    const msg = JSON.parse(message);
    switch (msg.action) {
        /**
         * Initialize the positioning model
         */
        case "init":
            init();
            self.postMessage(JSON.stringify({
                event: msg.action,
                args: []
            }));
            break;
        /**
         * Connect to a remote server
         */
        case "connect":
            const service = model.findService(SocketClient);
            model.logger('debug', {
                message: "Connection request received to " + msg.url
            });
            service.connect({
                path: "/api/v1",
                url: msg.url
            }).then(() => {
                // We start the IMU sensor and stop it immediately
                // This is to flush the buffer of the sensor. You do not need to
                // do this for BLE/WLAN and only magenetometer data
                return (model.findNodeByName("imu-source") as IMUSourceNode).start();
            }).then(() => {
                (model.findNodeByName("imu-source") as IMUSourceNode).stop();
                self.postMessage(JSON.stringify({
                    event: msg.action,
                    args: [
                        true
                    ]
                }));
            }).catch(() => {
                self.postMessage(JSON.stringify({
                    event: msg.action,
                    args: [
                        false
                    ]
                }));
            });
            break;
        /**
         * Start recording data
         */
        case "startRecording":
            position = DataSerializer.deserialize(msg.position);
            recording = true;
            Promise.all([
                //(model.findNodeByName("wlan-source") as WLANSourceNode).start(),
                //(model.findNodeByName("imu-source") as IMUSourceNode).start(),
                (model.findNodeByName("ble-source") as BLESourceNode2).start()
            ]).then(() => {
                self.postMessage(JSON.stringify({
                    event: msg.action,
                    args: []
                }));
                model.logger('debug', {
                    message: "Started recording!"
                });
            }).catch(ex => {
                model.logger('error', ex);
            });
            break;
        /**
         * Stop recording data
         */
        case "stopRecording":
            recording = false;
            //(model.findNodeByName("wlan-source") as WLANSourceNode).stop();
            //(model.findNodeByName("imu-source") as IMUSourceNode).stop();
            (model.findNodeByName("ble-source") as BLESourceNode2).stop();
            self.postMessage(JSON.stringify({
                event: msg.action,
                args: []
            }));
            model.logger('debug', {
                message: "Stopped recording!"
            });
            break;
    }
};

function init() {
    ModelBuilder.create()
        .addService(new SocketClient())
        .withLogger((level: string, log: any) => {
            self.postMessage(JSON.stringify({
                event: 'log',
                args: [level, log]
            }));
        })
        .from(
            new WLANSourceNode({
                source: new DataObject(phoneUID + "_wlan"),
                name: "wlan-source",
                interval: 0,
                persistence: false,
            }),
            new IMUSourceNode({
                source: new DataObject(phoneUID + "_imu"),
                name: "imu-source",
                interval: 20, // 20ms for training
                persistence: false,
                softStop: true,
                sensors: [
                    SensorType.GYROSCOPE,
                    SensorType.ACCELEROMETER,
                    SensorType.ORIENTATION,
                    SensorType.MAGNETOMETER
                ]
            }),
            new BLESourceNode2({
                source: new DataObject(phoneUID + "_ble"),
                name: "ble-source",
                persistence: false,
                uuids: ['0000fef5-0000-1000-8000-00805f9b34fb']
            })
        )
        .filter(() => recording)
        .via(new CallbackNode((frame: DataFrame) => {
            frame.source.setPosition(position);
            console.log("antes de pull");
            self.postMessage(JSON.stringify({
                event: 'log',
                args: ["info", "call!"]
            }));
        }))
        // Create chunks of 250 frames before sending. Timeout and send frames (smaller than 250x) after 1000 ms
        // If you enable this. Make sure you have a ".flatten()" function on the server
        //.chunk(250, 1000, TimeUnit.MILLISECOND)
        //.via(new TimedPullNode(1000, TimeUnit.MILLISECOND))
        .via(new FrameMergeNode((frame) => frame.source.uid, (frame) => frame.uid, {
            timeout: 1000,                      // After 1000ms, push the frame
            timeoutUnit: TimeUnit.MILLISECOND,
            minCount: 1,                        // Minimum amount of frames to receive
            maxCount: 5                         // Max count can be as big as you want
            // if exceeded, frame will be pushed. If left out, it will take the amount of
            // incomming nodes as the maxCount (which is 1, meaning the frame merge node is useless)
        }))
        .to(new SocketClientSink({
            uid: "online"
        }))
        .build().then(m => {
            model = m;
            model.logger('debug', {
                message: "Model build!"
            });
        }).catch(console.error);
}
