//import express.js
var express = require('express');
//assign it to variable app
var app = express();
//create a server and pass in app as a request handler
var serv = require('http').Server(app); //Server-11

//send a index.html file when a get request is fired to the given
//route, which is ‘/’ in this case
app.get('/',function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
//this means when a get request is made to ‘/client’, put all the
//static files inside the client folder
//Under ‘/client’. See for more details below

app.use('/client',express.static(__dirname + '/client'));

//listen on port 2000
serv.listen(process.env.PORT || 2000);
console.log("Server started.");

//this is where we will store all the players in the client,
// which is connected to the server
var player_lst = [];

// A player “class”, which will be stored inside player list
var Player = function (startX, startY, startAngle) {
    this.x  = startX;
    this.y = startY;
    this.angle = startAngle;
}

// when a new player connects, we make a new instance of the player object,
// and send a new player message to the client.
function onNewplayer (data) {
    console.log(data);

    //Созадем объект нового игрока
    var newPlayer = new Player(data.x, data.y, data.angle);
    console.log(newPlayer);

    console.log("Создан новый игрок с  id " + this.id);
    newPlayer.id = this.id;

    //Информация которая будет отправлена всем клиентам кроме отправляющего
    var current_info = {
        id: newPlayer.id,
        x: newPlayer.x,
        y: newPlayer.y,
        angle: newPlayer.angle
    };

    //Отправить информацию о всех игроках новому подключенному игроку
    for (i = 0; i < player_lst.length; i++) {
        var existingPlayer = player_lst[i];
        var player_info = {
            id: existingPlayer.id,
            x: existingPlayer.x,
            y: existingPlayer.y,
            angle: existingPlayer.angle
        };
        console.log("pushing player");
        //Отправить информацию обо всех пользователях подключенному игроку
        this.emit("new_enemyPlayer", player_info);
    }

    //Отправить о подключенном игроке всем пользователям
    this.broadcast.emit('new_enemyPlayer', current_info);

    player_lst.push(newPlayer);

}

// обновляем позицию игрока и отправляем информацию каждому клиенту, кроме Отправителя
function onMovePlayer (data) {   
    var movePlayer = find_playerid(this.id);
    movePlayer.x = data.x;
    movePlayer.y = data.y;
    movePlayer.angle = data.angle;

    var moveplayerData = {
        id: movePlayer.id,
        x: movePlayer.x,
        y: movePlayer.y,
        angle: movePlayer.angle
    }

    //отправить информацию о перемещениях игрока
    this.broadcast.emit('enemy_move', moveplayerData);
}

//Удаляем пользователя отправляем информацию об удалении
function onClientdisconnect() {
    console.log('disconnect');

    var removePlayer = find_playerid(this.id);

    if (removePlayer) {
        player_lst.splice(player_lst.indexOf(removePlayer), 1);
    }

    console.log("removing player " + this.id);

    //send message to every connected client except the sender
    this.broadcast.emit('remove_player', {id: this.id});

}

// Найти пользователя по id сокета
function find_playerid(id) {

    for (var i = 0; i < player_lst.length; i++) {

        if (player_lst[i].id == id) {
            return player_lst[i];
        }
    }

    return false;
}


// binds the serv object we created to socket.io
var io = require('socket.io')(serv,{});

//События для соединенного клиента
io.sockets.on('connection', function(socket){
    console.log("socket connected");
    socket.on('disconnect', onClientdisconnect);
    socket.on("new_player", onNewplayer);
    socket.on("move_player", onMovePlayer);
});