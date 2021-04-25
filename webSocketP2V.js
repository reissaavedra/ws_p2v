const mongoose = require('mongoose');
const WebSocket = require('ws');
//Declaracion de ws
const wss = new WebSocket.Server({ port: 8080 });

//Connection to Mongdb
mongoose.connect('mongodb://127.0.0.1/local', 
                {useNewUrlParser: true, 
                 useUnifiedTopology: true});

const db = mongoose.connection;

db.on('error', function(){
  console.error.bind(console, 'connection error:');
  console.log(console, 'connection error');
});

db.once('open', function() {
    console.log('MongoDB connection successful');

    var LocationSchema = mongoose.Schema({
        usr_id: String,
        org_id: String,
        pos_latitude: Number,
        pos_longitude: Number,
        pos_time: Number,
        usr_active : Boolean,
        usr_sending_video:Boolean,
        pos_speed: Number,
        battery : Object,
        networkInfo: Object,
        address: Object
    });

    var HistorySchema = mongoose.Schema({
        org_id: String,
        usr_id: String,
        info_coordinates: Object
    });

    var AlertSchema = mongoose.Schema({
      usr_id: String,
      pos_latitude: Number,
      pos_longitude: Number,
      pos_time: Number
    });

  let arrayWS = {};

  var Location = mongoose.model('Location', LocationSchema);
  var History = mongoose.model('History', HistorySchema);
  var Alert = mongoose.model('Alert', AlertSchema);

  
        function noop() {}
 
        function heartbeat() {
            this.isAlive = true;
        }
    
    wss.on('connection', function connection(ws,req) {
        ws.isAlive = true;
        ws.on('pong', heartbeat);

        var strReq = req.url.split("/");
        strReq.shift();
        let typeUser = strReq[0];
        let idOrganization = strReq[1];
        let idUser = strReq[2];

        let date = Date.now();
        
        let idWs = idOrganization+'/'+idUser+'/'+ date;

        ws.id = idWs;

        let currentWS = arrayWS[idOrganization];
        if(currentWS == undefined){
            arrayWS[idOrganization] = {};
            arrayWS[idOrganization][idUser] = {};
            arrayWS[idOrganization][idUser][idWs] = ws;
        }else{
            let arrayUserId = arrayWS[idOrganization][idUser];
            if(arrayUserId == undefined){
                arrayWS[idOrganization][idUser] = {};
                arrayWS[idOrganization][idUser][idWs] = ws;
            }else{
                arrayWS[idOrganization][idUser][idWs] = ws;
            }            
        }

        Location.find({'org_id' : idOrganization}, function (err, docs) {
            var json_docs_act_stream = [];
            var json_docs_inact = [];
            var json_docs_act_not_str = [];
    
            for(i=0; i<docs.length;i++){
                json_doc = {
                    "type": "Feature",
                    "id" : docs[i].usr_id,
                    "properties": {
                        "title": docs[i].usr_id,
                        "time": docs[i].pos_time,
                        "battery": JSON.stringify(docs[i].battery),
                        "networkInfo": JSON.stringify(docs[i].networkInfo),
                        "speed": docs[i].pos_speed,
                        "address" :  JSON.stringify(docs[i].address),
                        "selected": false,
                        "favourite": false},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [docs[i].pos_longitude, docs[i].pos_latitude]
                    }
                };
    
                if(docs[i].usr_active == true){
                    if(docs[i].usr_sending_video == true){
                        json_docs_act_stream.push(json_doc);
                    }else{
                        json_docs_act_not_str.push(json_doc);
                    }
                }else{
                    json_docs_inact.push(json_doc);
                } 
            }
    
            var geo_json ={ 0:
                          {"type": "FeatureCollection",
                           "features": json_docs_inact},
                          1:
                          {"type": "FeatureCollection",
                           "features": json_docs_act_not_str},
                          2:
                          {"type": "FeatureCollection",
                            "features": json_docs_act_stream}                      
                        };
            var docs_string = JSON.stringify(geo_json);
    
            ws.send(docs_string);
        });

        ws.on('message', function incoming(message){
            //console.log(message);
            data_message = JSON.parse(message);

            switch(data_message.Type){
                case "Handshake":
                    console.log("User connected: "+data_message.User);
                    let filterHs = {usr_id: data_message.User,org_id: data_message.Org};
                    let updateHs = {
                        usr_active : true,
                        usr_sending_video:false
                    };
                    var optionsHs = {new: true,upsert: true,setDefaultsOnInsert: true};
                    Location.findOneAndUpdate(filterHs,updateHs,optionsHs,function (error, doc) {if(error)console.log(error);});
                    break;
                
                case "StartVS":
                    console.log('User start vs : '+ data_message.User);
                    let idOrgStartVs = data_message.Org;
                    let idUserVs = data_message.User;
                    let filterStartVs = { usr_id: idUserVs,org_id:idOrgStartVs };
                    let updateStartVs = {usr_sending_video: true};
                    let optionsStartVs = {new: true,upsert: true};
                
                    Location.findOneAndUpdate(filterStartVs, updateStartVs,optionsStartVs, 
                        function (error, doc) {
                            if(error)console.log(error);});


                    Location.find({}, function (err, docs) {

                        let json_docs_act_stream = [];
                        let json_docs_inact = [];
                        let json_docs_act_not_str = [];

                        let i = 0;
                                        
                        for(i=0; i<docs.length;i++){
                            json_doc = {
                                "type": "Feature",
                                "id" : docs[i].usr_id,
                                "properties": {
                                    "title": docs[i].usr_id,
                                    "selected": false,
                                    "battery": JSON.stringify(docs[i].battery),
                                    "networkInfo": JSON.stringify(docs[i].networkInfo),
                                    "speed": docs[i].pos_speed,
                                    "address" :  JSON.stringify(docs[i].address),
                                    "favourite": false
                                },
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [docs[i].pos_longitude, docs[i].pos_latitude]
                                }
                            };

                            if(docs[i].usr_active == true){
                                if(docs[i].usr_sending_video == true){
                                    json_docs_act_stream.push(json_doc);
                                }else{
                                    json_docs_act_not_str.push(json_doc);
                                }
                            }else{
                                    json_docs_inact.push(json_doc);
                            } 
                        }
                                        
                        var geo_json = 
                        { 
                            0:  
                                {"type": "FeatureCollection",
                                 "features": json_docs_inact},
                            1:
                                {"type": "FeatureCollection",
                                 "features": json_docs_act_not_str},
                            2:
                                {"type": "FeatureCollection",
                                  "features": json_docs_act_stream}                      
                        };
                                                          
                        var docs_string = JSON.stringify(geo_json);
                                        
                        // wss.clients.forEach(function each(client) {
                        //     if (client.readyState === WebSocket.OPEN){
                        //         client.send(docs_string);
                        //     }
                        // });

                        console.log(docs_string);

                        let valuesIdUsers = Object.values(arrayWS[idOrganization]);
                        let wsOrg = Object.values(valuesIdUsers);
                        
                        i = 0;
                        let wsToSend = wsOrg[i];
                        
                        let arrWsSend = Object.values(wsToSend);
                        while(i<arrWsSend.length){
                            arrWsSend[i].send(docs_string);
                            //console.log('Se envio a: '+ arrWsSend[i].id);
                            i = i+1;
                        }
                        console.log(idUserVs +' inció su transmisión: ');
                        console.log('-----------------------------------');

                        // let alert_vs = {
                        //     'type': 'startVideo',
                        //     'user': data_message.User
                        // }

                        // let j = 0;

                        // while(j<arrWsSend.length){
                        //     arrWsSend[j].send(JSON.stringify(alert_vs));
                        //     //console.log('Se envio a: '+ arrWsSend[i].id);
                        //     j = j+1;
                        // }
                        // console.log(idUserVs +' inció su transmisión ')
                        // console.log('-----------------------------------');
                    });
                                
                    
                                        
                    // wss.clients.forEach(function each(client) {
                    //     if (client!=ws && client.readyState === WebSocket.OPEN) {client.send(JSON.stringify(alert_send));}
                    // });

                    // let valuesIdUsers = Object.values(arrayWS[idOrganization]);
                    // let wsOrg = Object.values(valuesIdUsers);
                        
                    
                    // let wsToSend = wsOrg[i];
                        
                    // let arrWsSend = Object.values(wsToSend);
                    
                break;

                case "EndVS":

                    let idOrgEndVs = data_message.Org;
                    let idUserEndVs = data_message.User;
                    let filterEndVs = { usr_id: idUserEndVs,org_id:idOrgEndVs };
                    let updateEndVs = {usr_sending_video:false};          
                    let optionsEndVs = {new: true,upsert: true,setDefaultsOnInsert: true};
                    Location.findOneAndUpdate(filterEndVs, updateEndVs,optionsEndVs, 
                        function (error, doc) {
                            if(error)console.log(error);
                        });
                    

                    Location.find({}, 
                        function (err, docs) {   
                            let json_docs_act_stream = [];
                            let json_docs_inact = [];
                            let json_docs_act_not_str = [];

                            

                            for(let i=0; i<docs.length;i++){
                              json_doc = 
                                {
                                    "type": "Feature",
                                    "id" : docs[i].usr_id,
                                    "properties": {
                                        "title": docs[i].usr_id,
                                        "selected": false,
                                        "battery": JSON.stringify(docs[i].battery),
                                        "networkInfo": JSON.stringify(docs[i].networkInfo),
                                        "speed": docs[i].pos_speed,
                                        "address" :  JSON.stringify(docs[i].address),
                                        "favourite": false},
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [docs[i].pos_longitude, docs[i].pos_latitude]
                                    }
                                };

                                if(docs[i].usr_active == true){
                                    if(docs[i].usr_sending_video == true){
                                        json_docs_act_stream.push(json_doc);
                                    }else{
                                        json_docs_act_not_str.push(json_doc);
                                    }
                                }else{
                                    json_docs_inact.push(json_doc);
                                } 
                            }

                            var geo_json =
                            { 
                                0:
                                    {"type": "FeatureCollection",
                                     "features": json_docs_inact},
                                1:
                                    {"type": "FeatureCollection",
                                     "features": json_docs_act_not_str},
                                2:
                                    {"type": "FeatureCollection",
                                     "features": json_docs_act_stream}                      
                            };
                            
                            var docs_string = JSON.stringify(geo_json);

                            // wss.clients.forEach(function each(client) {
                            //     if (client.readyState === WebSocket.OPEN){
                            //         client.send(docs_string);
                            //     }
                            // });

                            let valuesIdUsers = Object.values(arrayWS[idOrgEndVs]);
                            let wsOrg = Object.values(valuesIdUsers);
                        
                            i = 0;
                            let wsToSend = wsOrg[i];
                        
                            let arrWsSend = Object.values(wsToSend);
                            while(i<arrWsSend.length){
                                arrWsSend[i].send(docs_string);
                                //console.log('Se envio a: '+ arrWsSend[i].id);
                                i = i+1;
                            }
                            console.log(idUserEndVs +' terminó su transmisión: ')
                            console.log('-----------------------------------');
                    });
                break;

                case 'Desactivate':
                    let idOrgDes = data_message.Org;
                    let idUserDes = data_message.User;
                    let filterDes = { usr_id: idUserDes,org_id:idOrgDes };                    
                    let updateDes = {usr_active:false,usr_sending_video:false};       
                    let optionsDes = {new: true,upsert: true,setDefaultsOnInsert: true};
                    
                    Location.findOneAndUpdate(filterDes, updateDes,optionsDes, function (error, doc) {if(error)console.log(error);});

                    Location.find({}, function (err, docs) {
                        let json_docs_act_stream = [];
                        let json_docs_inact = [];
                        let json_docs_act_not_str = [];
                        
                        
                        for(let i=0; i<docs.length;i++){
                            json_doc = 
                                {
                                    "type": "Feature",
                                    "id" : docs[i].usr_id,
                                    "properties": {
                                        "title": docs[i].usr_id,
                                        "battery": JSON.stringify(docs[i].battery),
                                        "networkInfo": JSON.stringify(docs[i].networkInfo),
                                        "speed": docs[i].pos_speed,
                                        "address" :  JSON.stringify(docs[i].address),
                                        "selected": false,
                                        "favourite": false
                                    },
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [docs[i].pos_longitude, docs[i].pos_latitude]
                                    }
                                };

                            if(docs[i].usr_active == true){
                                if(docs[i].usr_sending_video == true){
                                    json_docs_act_stream.push(json_doc);
                                }else{
                                    json_docs_act_not_str.push(json_doc);
                                }
                            }else{
                                json_docs_inact.push(json_doc);
                            }                                                          
                        }

                        var geo_json ={ 0:
                                        {"type": "FeatureCollection",
                                        "features": json_docs_inact},
                                        1:
                                        {"type": "FeatureCollection",
                                        "features": json_docs_act_not_str},
                                        2:
                                        {"type": "FeatureCollection",
                                        "features": json_docs_act_stream}                      
                                    };
                        let docs_string = JSON.stringify(geo_json);

                        // wss.clients.forEach(function each(client) {
                        //     if (client.readyState === WebSocket.OPEN) {
                        //         client.send(docs_string);
                        //     }
                        // });

                        let valuesIdUsers = Object.values(arrayWS[idOrganization]);
                        let wsOrg = Object.values(valuesIdUsers);
                        
                        let i = 0;
                        let wsToSend = wsOrg[i];
                        
                        let arrWsSend = Object.values(wsToSend);
                        while(i<arrWsSend.length){
                            arrWsSend[i].send(docs_string);
                            //console.log('Se envio a: '+ arrWsSend[i].id);
                            i = i+1;
                        }
                        console.log(idUserDes +' se desactivó: ')
                        console.log('-----------------------------------');
                    });
                break;

                case "Location":
                    let idOrgLoc = data_message.Org;
                    let idUserLoc = data_message.User;
                    let filter = {usr_id: idUserLoc,org_id: idOrgLoc};
                    //console.log(data_message.Org);

                    let dateLocation = new Date().getTime();
                    let update = {
                        pos_longitude: data_message.Longitude,
                        pos_latitude: data_message.Latitud,
                        pos_time: dateLocation,
                        pos_speed : data_message.Speed,
                        battery :  data_message.Battery,
                        networkInfo : data_message.NetInfo,
                        address : data_message.Address,
                        usr_active : true
                    };
              
                    let options = {new: true,upsert: true,setDefaultsOnInsert: true};

                    Location.findOneAndUpdate(filter, update,options, 
                        function (error, doc) {
                            if(error)console.log(error);
                        }
                    );

                    let insertedRegister = {
                        [dateLocation]:
                            {
                                coordinates: [data_message.Longitude,data_message.Latitud],
                                speed : data_message.Speed,
                                battery :  data_message.Battery,
                                networkInfo : data_message.NetInfo,
                                address : data_message.Address,
                                usr_active : true
                            }

                    }


                    let updateHistory = {
                        $addToSet: { info_coordinates: insertedRegister } 
                    };

                    History.findOneAndUpdate(filter, updateHistory, options,function (error, doc) {
                        if(error)console.log(error);
                        //console.log(doc);
                    })                    
                    

                    Location.find({'org_id' : idOrganization}, 
                    function (err, docs) {
                        let json_docs_act_stream = [];
                        let json_docs_inact = [];
                        let json_docs_act_not_str = [];

                        for(let i=0; i<docs.length;i++){
                            json_doc = {
                                "type": "Feature",
                                "id" : docs[i].usr_id,
                                "properties": {
                                    "title": docs[i].usr_id,
                                    "time": docs[i].pos_time,
                                    "battery": JSON.stringify(docs[i].battery),
                                    "networkInfo": JSON.stringify(docs[i].networkInfo),
                                    "speed": docs[i].pos_speed,
                                    "address" :  JSON.stringify(docs[i].address),
                                    "selected": false,
                                    "favourite": false},
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [docs[i].pos_longitude, docs[i].pos_latitude]
                                }
                            };

                            if(docs[i].usr_active == true){
                                if(docs[i].usr_sending_video == true){
                                    json_docs_act_stream.push(json_doc);
                                }else{
                                    json_docs_act_not_str.push(json_doc);
                                }
                            }else{
                                json_docs_inact.push(json_doc);
                            } 
                        }

                        let geo_json ={ 0:
                                            {"type": "FeatureCollection",
                                            "features": json_docs_inact},
                                        1:
                                            {"type": "FeatureCollection",
                                            "features": json_docs_act_not_str},
                                        2:
                                            {"type": "FeatureCollection",
                                            "features": json_docs_act_stream}                      
                                        };
                        let docs_string = JSON.stringify(geo_json);

                        let valuesIdUsers = Object.values(arrayWS[idOrganization]);
                        let wsOrg = Object.values(valuesIdUsers);
                        
                        let i = 0;
                        let wsToSend = wsOrg[i];
                        
                        let arrWsSend = Object.values(wsToSend);
                        while(i<arrWsSend.length){
                            arrWsSend[i].send(docs_string);
                            //console.log('Se envio a: '+ arrWsSend[i].id);
                            i = i+1;
                        }
                        console.log(idUserLoc +' acttualizón su posición: '+insertedRegister[dateLocation].coordinates)
                        console.log('-----------------------------------');                       
                    });
                break;

                case "Alert":
                    let alert = 
                        new Alert(
                            {
                                usr_id: data_message.User,
                                pos_latitude: data_message.Latitude,
                                pos_longitude: data_message.Longitude,
                                pos_time: new Date().getTime()
                            });
                    
                    alert.save(
                        function(err){
                            if(err)return console.log(err);
                        });

                    let alert_send = 
                        {
                            'type': 'alert',
                            'user': data_message.User,
                            'lat': data_message.Latitude,
                            'long': data_message.Longitude,
                        }

                    wss.clients.forEach(function each(client) {
                        if (client!=ws && client.readyState === WebSocket.OPEN) {
                            client.send(JSON.stringify(alert_send));
                        }
                    });
                break;
            }
        });

        ws.on('close',function close(evt,msg){
            let idWsKilled = ws.id;
            let valueId = idWsKilled.split("/");
            let idOrganizationKilled = valueId[0];
            let idUserKilled = valueId[1];
            //Remove estos ids
            delete arrayWS[idOrganizationKilled][idUserKilled][idWsKilled];
        });
    });

    // const interval = setInterval(function ping() {
    //     wss.clients.forEach(function each(ws) {
    //       if (ws.isAlive === false) return ws.terminate();
       
    //       ws.isAlive = false;
    //       ws.ping(noop);
    //       console.log('Revisado');
    //     });
    // }, 1500);

    wss.on('close', function close(){
        clearInterval(interval);
        console.log('cerro')
    });
});
