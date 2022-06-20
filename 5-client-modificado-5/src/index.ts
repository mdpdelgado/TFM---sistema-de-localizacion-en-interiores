import { CallbackSinkNode, DataFrame, DataObject, GraphBuilder, Model, ModelBuilder } from '@openhps/core';
import { SocketClient, SocketClientSink, SocketClientSource } from '@openhps/socket';
import { RelativeRSSI, BLEObject } from '@openhps/rf';
import {CSVDataSink, CSVDataSource, CSVDataSourceOptions} from '@openhps/csv';
import { GraphShape } from '@openhps/core/dist/types/graph/_internal/implementations';

console.log("Creating the positioning model ...");

var array: DataFrame[] = [];

ModelBuilder.create()
    .withLogger(console.log)            // Optional: useful with troubleshooting
    // Create a socket client. One positioning model might have a connection to a server
    // with multiple endpoints.
    .addService(new SocketClient({
        url: "http://localhost:3000",
        path: "/api/v1"
    }))

    .addShape(GraphBuilder.create()
        // Source csv
        .from(new CSVDataSource("C:/Users/Pi/Desktop/TFM/modificados/5-client-modificado-5/data/example1.csv", (row: any) => {

                    const dataFrame = new DataFrame();
                                    
                    dataFrame.source = new DataObject(row.ID, row.ID);
                    
                    const rssi1 = Number(row.RSSI1);
                    const rssi2 = Number(row.RSSI2);
            
                    
                    dataFrame.source.addRelativePosition(new RelativeRSSI(new BLEObject("5DC48FBFB912"), rssi1));
                    dataFrame.source.addRelativePosition(new RelativeRSSI(new BLEObject("3E182D702D4C"), rssi2));
                                
                    //console.log(dataFrame);
                    //console.log(dataFrame.source.getRelativePositions());
                    
                    array.push(dataFrame);
                    
                    return dataFrame;
        }))

        // Socket sink, data is transmitted to a server on port 3000
        .to(new SocketClientSink({
            uid: "online"
    })))
    
    .addShape(GraphBuilder.create()
        .from(new SocketClientSource({
            uid: "output"       // Matches uid of the server sink
        }))
        .to(new CallbackSinkNode(frame => {
            console.log("Response from server", frame.source.position.toVector3());
    })))

    .build().then((model: Model) => {
        
        //console.log(array[0]);
        //console.log(array[1]);

        for(let i in array){
            model.push(array[i]);
        }
        
        console.log("Client positioning model created ...");

        
    }).then(() => {}).catch(console.error);
