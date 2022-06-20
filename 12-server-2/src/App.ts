/**
 * This file contains the server logic.
 */

import { Absolute2DPosition, AccuracyModifierNode, AngleUnit, CellIdentificationNode, DataFrame, DataObject, DataObjectService, FrameMergeNode, GraphBuilder, MemoryDataService, Model, ModelBuilder, MultilaterationNode, Orientation, PushOptions, CallbackNode, TrajectoryService, Trajectory, CallbackSinkNode } from '@openhps/core';
import { SocketServer, SocketServerSink, SocketServerSource } from '@openhps/socket';
import { BLEObject, PropagationModel, RelativeRSSI, RelativeRSSIProcessing, WLANObject } from '@openhps/rf';
import * as http from 'http';
import { DistanceFunction, Fingerprint, FingerprintingNode, FingerprintService, KNNFingerprintingNode, WeightFunction } from '@openhps/fingerprinting';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import { MongoDataServiceDriver } from '@openhps/mongodb';
import { CSVDataSource, CSVDataSink } from '@openhps/csv';

export class App {
    server: http.Server;
    model: Model;
	//objectDataService: DataObjectService<DataObject>;
    
	constructor() {
        this.initialize();
    }

    protected async initialize(): Promise<void> {
        this.initServer();
        await this.initModel();
        await this.loadDataset();
    }

    /**
     * Initialize the server
     */
    protected initServer(): void {
        this.server = http.createServer().listen(3000);
    }

    /**
     * Initialize the positioning model
     */
    protected initModel(): Promise<void> {
        return new Promise((resolve, reject) => {
            ModelBuilder.create()
                // We add a socket server service. One positioning model can have multiple 'endpoints'
                // that use the same server. The endpoints are the nodes, the server is the service we add here
                .addService(new SocketServer({
                    srv: this.server,               // Server to use for socket server
                    path: "/api/v1",                // Base URI for the socket server
                }))
                .addService(new FingerprintService(new MongoDataServiceDriver(
                    Fingerprint, {
                        dbURL: "mongodb://admin:p%40ssw0rd@localhost:27017/?authSource=admin", //mongodb://localhost:27017
                        dbName: "ipin2021t-2"
                    }), {
                    classifier: "wlan",             // Fingerprint service for WLAN
                    defaultValue: -95,              // Default value for NaN RSSI values
                    autoUpdate: false,              // Auto update would update the fingerprints on 'every' new offline fingerprint
                    // Group fingerprints by their position + orientation (meaning orientation is taken into account)
                    groupBy: (pos) => ({ pos: pos.toVector3(), orientation: pos.orientation })
                }))
                .addService(new FingerprintService(new MongoDataServiceDriver(
                    Fingerprint, {
                        dbURL: "mongodb://admin:p%40ssw0rd@localhost:27017/?authSource=admin",
                        dbName: "ipin2021t-2"
                    }), {
                    classifier: "ble",              // Fingerprint service for BLE beacons
                    defaultValue: -100,             // Default value for NaN RSSI values
                    autoUpdate: false,              // Auto update would update the fingerprints on 'every' new offline fingerprint
                    groupBy: (pos) => ({ pos: pos.toVector3(), orientation: pos.orientation })
                }))
                .addService(new DataObjectService(new MongoDataServiceDriver(
                    WLANObject, {
                        dbURL: "mongodb://admin:p%40ssw0rd@localhost:27017/?authSource=admin",
                        dbName: "ipin2021t-2"
                    })))
                .addService(new DataObjectService(new MongoDataServiceDriver(
                    BLEObject, {
                        dbURL: "mongodb://admin:p%40ssw0rd@localhost:27017/?authSource=admin",
                        dbName: "ipin2021t-2"
                    })))

				
				.addService(new TrajectoryService(new MongoDataServiceDriver(
					Trajectory, {
						dbURL: "mongodb://admin:p%40ssw0rd@localhost:27017/?authSource=admin",
						dbName: "position"
					}), {
						dataService: DataObject, // If you want to store trajectory of BLEObject, use BLEObject
						autoBind: false // You manually have to "appendPosition" in a sink
					}))
				
                // Offline stage (compatible with the IPIN 2021 application)
                .addShape(GraphBuilder.create()
                    .from(new SocketServerSource({
                        uid: "offline",     // /api/v1/offline
                        persistence: false  // Persistence false ensures that no 'stored' data on the server overrides the data send by the client
                    }), "internal") // Internal is a placeholder for storing the dataset
                    .flatten()
                    // Store fingerprints
                    .via(
                        new FingerprintingNode({
                            classifier: "wlan",
                            frameFilter: (frame) => frame.source.uid.endsWith("_wlan")
                        }), 
                        new FingerprintingNode({
                            classifier: "ble",
                            frameFilter: (frame) => frame.source.uid.endsWith("_ble")
                        })
                    )
                    .store())
                // Online stage (application/client not released due to containing additional logging for dataset)
                .addShape(GraphBuilder.create()
                    .from(new SocketServerSource({
                        uid: "online",
                        persistence: true   // Use previous stored data
                    }))
                    // Process fingerprints
                    .via(
                        GraphBuilder.create()
                        .from()
                        .filter(() => true) // Set to false to disable BLE fingerprinting
                        .clone()
                        .via(new KNNFingerprintingNode({
                            weighted: true,
                            k: 3,
                            classifier: "ble",
                            weightFunction: WeightFunction.SQUARE,
                            similarityFunction: DistanceFunction.EUCLIDEAN,
                            uid: "ble-fingerprinting"
                        }))
                        .filter((frame: DataFrame) => frame.source.position ? 
                            (frame.source.position.timestamp >= frame.createdTimestamp) : false)
                        .via(new AccuracyModifierNode({
                            value: 15,      // Something to play around with, set the accuracy to 15m (can also be a modifier)
                        }))
                        .to(),
                    GraphBuilder.create()
                        .from()
                        .filter(() => false) // Set to false to disable WLAN fingerprinting
                        .clone()
                        .via(new KNNFingerprintingNode({
                            weighted: true,
                            k: 4,
                            classifier: "wlan",
                            weightFunction: WeightFunction.SQUARE,
                            similarityFunction: DistanceFunction.EUCLIDEAN,
                            uid: "wlan-fingerprinting"
                        }))
                        .filter((frame: DataFrame) => frame.source.position ? 
                            (frame.source.position.timestamp >= frame.createdTimestamp) : false)
                        .via(new AccuracyModifierNode({
                            value: 1.2,     // Something to play around with, set the accuracy to 1.2m (can also be a modifier)
                        }))
                        .to(),
                    GraphBuilder.create()
                        .from()
                        .filter(() => false) // Set to false to disable BLE cell identification
                        .clone()
                        .via(
                            new RelativeRSSIProcessing({
                                propagationModel: PropagationModel.LOG_DISTANCE,
                            })
                        )
                        .via(
                            new CellIdentificationNode({
                                maxDistance: 1.5,
                            })
                        )
                        .filter((frame: DataFrame) => frame.source.position ? 
                            (frame.source.position.timestamp >= frame.createdTimestamp) : false)
                        .to(),
                    GraphBuilder.create()
                        .from()
                        .filter(() => false) // Set to false to disable BLE multilateration
                        .clone()
                        .via(
                            new RelativeRSSIProcessing({
                                propagationModel: PropagationModel.LOG_DISTANCE
                            })
                        )
                        .via(
                            new MultilaterationNode({
                                maxIterations: 1000,
                                incrementStep: 0.5,
                                minReferences: 2,
                                uid: "ble-multilateration"
                            })
                        )
                        .filter((frame: DataFrame) => frame.source.position ? 
                            (frame.source.position.timestamp >= frame.createdTimestamp) : false)
                        .via(new AccuracyModifierNode({
                            value: 15
                        }))
                        .to(),
                    )
                    // Merge the three output positions
                    .via(new FrameMergeNode(
                        // Merge by source UID (device ID)
                        (frame: DataFrame) => frame.source.uid,
                        // Group by last node. Grouping means that if two frames are received from CellID,
                        // they will be merged
                        (frame: DataFrame, options?: PushOptions) => options.lastNode,
                        {
                            timeout: 300,   // Timeout before pushing to the next node in ms
                            minCount: 1,    // Minimum amount of incoming frames needed (1 = 1 algorithm)
                        }
                    ))
					
					.via(new CallbackNode(frame => {
						console.log("Position from server", frame.source.position.toVector3());
						console.log("----------------------------");
						
						//const object = frame.source.position.toVector3();
						//objectDataService.insert(object.uid, object);
					}))
					
                    .to(new SocketServerSink({
                        uid: "feedback",        // Feedback sink to send back to client
                        persistence: false
                    }), new CSVDataSink(path.join(__dirname, "example1_output_on.csv"), [
							//{ id: "time", title: "time" },
							//{ id: "name", title: "name" },
							{ id: "x", title: "x" },
							{ id: "y", title: "y" }
					], frame => {
						return {
							//time: frame.source.position.timestamp,
							//name: frame.source.uid,
							x: frame.source.position.toVector3().x,
							y: frame.source.position.toVector3().y
						};
					}), new CallbackSinkNode(function(frame: DataFrame) {
							return new Promise((resolve, reject) => {
								// The trajectory service will not store automatically

								const service: TrajectoryService = this.model.findDataService(Trajectory);
								// Append the position (similar to autoBind=true)
								// service.appendPosition(frame.source);

								// Append the position with a custom UID for the trajectory
								service.appendPosition(frame.source, frame.source.uid + "_movement").then(() => {
									resolve();
								}).catch(reject);
							});
						})
					)
					)
                .build().then(model => {
                    
					console.log("Model is ready!");
                    this.model = model;
                    resolve();
                }).catch(reject);
        });
    }

    public loadDataset(): Promise<void> {
        return new Promise((resolve) => {
            Promise.all([
                this.loadBLEBeacons(),
                //this.loadTrainWLAN(),
                //this.loadTrainBLE()
            ]).then(results => {
                const promises: Promise<any>[] = [];
                results.forEach(result => {
                    result.map(frame => promises.push(this.model.findNodeByName("internal").push([frame])));
                });
                return Promise.all(promises);
            }).then(async () => {
                const wlanService = (this.model.findDataService("wlan") as FingerprintService);
                const bleService = (this.model.findDataService("ble") as FingerprintService);
                const beacons = (this.model.findDataService(BLEObject) as any);
               
				
				await wlanService.update();
                await bleService.update();
                console.log(`WLAN Fingerprints: ${wlanService.cache.length}`);
                console.log(`BLE Fingerprints: ${bleService.cache.length}`);
                //console.log(`Beacons: ${beacons.driver._data.size}`);
                resolve();
            });
        });
    }

    public loadBLEBeacons(): Promise<DataFrame[]> {
        return new Promise((resolve, reject) => {
            const frames: DataFrame[] = [];
            fs.createReadStream(path.join(__dirname, "../", "ble_devices2.csv"))
                .pipe(csv())
                .on('data', (data: any) => {
                    const object = new BLEObject(data.ID);
                    object.position = new Absolute2DPosition(
                        parseFloat(data.X),
                        parseFloat(data.Y),
                    );
                    object.calibratedRSSI = -67;
                    object.environmentFactor = 2.2;

                    const frame = new DataFrame(object);
                    frame.createdTimestamp = parseInt(data['TIMESTAMP']);
                    frames.push(frame);
                })
                .on('end', () => {
                    resolve(frames);
                })
                .on('error', reject);
        });
    }

    public loadTrainBLE(): Promise<DataFrame[]> {
        return new Promise((resolve, reject) => {
            const frames: DataFrame[] = [];
            fs.createReadStream(path.join(__dirname, "../", "ble_fingerprints.csv"))
                .pipe(csv())
                .on('data', (data: any) => {
                    const object = new DataObject("phone_ble");
                    object.position = new Absolute2DPosition(
                        parseFloat(data.X),
                        parseFloat(data.Y)
                    );
                    object.position.orientation = Orientation.fromEuler({
                        pitch: 0,
                        roll: 0,
                        yaw: parseFloat(data.ORIENTATION),
                        unit: AngleUnit.DEGREE
                    });
                    for (let key in data) {
                        const rssi = parseFloat(data[key]);
                        if (key.includes("BEACON_") && rssi !== 100) {
                            object.addRelativePosition(
                                new RelativeRSSI(new BLEObject(key), rssi)
                            );
                        }
                    }
                    const frame = new DataFrame(object);
                    frame.createdTimestamp = parseInt(data['TIMESTAMP']);
                    frames.push(frame);
                })
                .on('end', () => {
                    resolve(frames);
                })
                .on('error', reject);
        });
    }

    public loadTrainWLAN(): Promise<DataFrame[]> {
        return new Promise((resolve, reject) => {
            const frames: DataFrame[] = [];
            fs.createReadStream(path.join(__dirname, "../", "wlan_fingerprints.csv"))
                .pipe(csv())
                .on('data', (data) => {
                    const object = new DataObject("phone_wlan");
                    object.position = new Absolute2DPosition(
                        parseFloat(data.X),
                        parseFloat(data.Y),
                    );
                    object.position.orientation = Orientation.fromEuler({
                      pitch: 0,
                      roll: 0,
                      yaw: parseFloat(data.ORIENTATION),
                      unit: AngleUnit.DEGREE
                    });
                    for (let key in data) {
                        const rssi = parseFloat(data[key]);
                        if (key.includes("WAP_") && rssi !== 100) {
                            object.addRelativePosition(
                                new RelativeRSSI(new WLANObject(key), rssi)
                            );
                        }
                    }
                    const frame = new DataFrame(object);
                    frame.createdTimestamp = parseInt(data['TIMESTAMP']);
                    frames.push(frame);
                })
                .on('end', () => {
                    resolve(frames);
                })
                .on('error', reject);
        });
    }
}
