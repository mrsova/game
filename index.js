var express = require('express');
//функция физики
var p2 = require('p2');
//библиотека уникальных идентификаторов для бонусов будет использоватться
var unique = require('node-uuid')

var app = express();
var serv = require('http').Server(app);
//Функция для движения пользователя рассчитывается на сервере
var physicsPlayer = require('./server/physics/playermovement.js');

app.get('/',function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use('/client',express.static(__dirname + '/client'));

serv.listen(process.env.PORT || 2000);
console.log("Server started.");

//Массив с игроками
var player_lst = [];

//Для обновления физики
var startTime = (new Date).getTime();
var lastTime;
var timeStep= 1/70;

// мир физики на сервере. Здесь происходит вся физика.
// мы устанавливаем силу тяжести на 0, так как мы просто следуем указателям мыши.
var world = new p2.World({
    gravity : [0,0]
});

//Класс для хранения игровых данных
var game_setup = function() {
    //Постоянное количество продуктов в игре
    this.food_num = 100;
    //Список продуктов
    this.food_pickup = [];
    //Высота экрана
    this.canvas_height = 4000;
    //Ширина экрана
    this.canvas_width = 4000;
}

// Создать новый игровой экземпляр
var game_instance = new game_setup();


//Класс игрока на сервере
var Player = function (startX, startY, startAngle) {
    this.x = startX
    this.y = startY
    this.angle = startAngle
    this.speed = 500;
    //We need to intilaize with true.
    this.sendData = true;
    this.size = getRndInteger(40, 100);
    this.dead = false;
}

//Класс еды на сервере
var foodpickup = function (max_x, max_y, type, id) {
    this.x = getRndInteger(10, max_x - 10) ;
    this.y = getRndInteger(10, max_y - 10);
    this.type = type;
    this.id = id;
    this.powerup;
}

//We call physics handler 60fps. The physics is calculated here.
setInterval(heartbeat, 1000/60);



//ФИзика
function physics_hanlder() {
    var currentTime = (new Date).getTime();
    timeElapsed = currentTime - startTime;
    var dt = lastTime ? (timeElapsed - lastTime) / 1000 : 0;
    dt = Math.min(1 / 10, dt);
    world.step(timeStep);
}

function heartbeat () {
    // количество продуктов, которые должны быть сгенерированы
    // в этой демонстрации, мы сохраняем пищу всегда на 100
    var food_generatenum = game_instance.food_num - game_instance.food_pickup.length;

    //add the food
    addfood(food_generatenum);
    //перенесли в физику
    physics_hanlder();
}

function addfood(n) {
    //return if it is not required to create food
    if (n <= 0) {
        return;
    }
    //create n number of foods to the game
    for (var i = 0; i < n; i++) {
        //create the unique id using node-uuid
        var unique_id = unique.v4();
        var foodentity = new foodpickup(game_instance.canvas_width, game_instance.canvas_height, 'food', unique_id);
        game_instance.food_pickup.push(foodentity);
        //set the food data back to client
        io.emit("item_update", foodentity);
    }
}


// когда новый игрок подключается, мы создаем новый экземпляр объекта игрока,
// и отправить клиенту новое сообщение игрока.
function onNewplayer (data) {
    console.log(data);
    //Новый игрок
    var newPlayer = new Player(data.x, data.y, data.angle);

    //Создать экземпляр физического тела игрока на сервере
    playerBody = new p2.Body ({
        mass: 0,
        position: [0,0],
        fixedRotation: true
    });

    //Добавить физическое тело в объект и отправить в мир
    newPlayer.playerBody = playerBody;
    world.addBody(newPlayer.playerBody);

    console.log("created new player with id " + this.id);
    newPlayer.id = this.id;

    this.emit('create_player', {size: newPlayer.size});

    //информация, отправляемая всем клиентам, кроме отправителя
    var current_info = {
        id: newPlayer.id,
        x: newPlayer.x,
        y: newPlayer.y,
        angle: newPlayer.angle,
        size: newPlayer.size
    };

    //Информация о все клиентах для отправителя
    for (i = 0; i < player_lst.length; i++) {
        existingPlayer = player_lst[i];
        var player_info = {
            id: existingPlayer.id,
            x: existingPlayer.x,
            y: existingPlayer.y,
            angle: existingPlayer.angle,
            size: existingPlayer.size
        };
        console.log("pushing player");
        //Отправить только отправителю информацию об игроках
        this.emit("new_enemyPlayer", player_info);
    }

    console.log(game_instance.food_pickup);
    //Сообщаем клиенту о продуктах которые существуют
    for (j = 0; j < game_instance.food_pickup.length; j++) {
        var food_pick = game_instance.food_pickup[j];
        this.emit('item_update', food_pick);
    }
    //Отправить всем информацию о новом игроке
    this.broadcast.emit('new_enemyPlayer', current_info);

    player_lst.push(newPlayer);
}

//вместо того, чтобы слушать позиции игроков, мы слушаем пользовательские входы
function onInputFired (data) {
    var movePlayer = find_playerid(this.id, this.room);
    if (!movePlayer || movePlayer.dead) {
        return;
        console.log('no player');
    }

    //when sendData is true, we send the data back to client.
    if (!movePlayer.sendData) {
        return;
    }

    //every 50ms, we send the data.
    setTimeout(function() {movePlayer.sendData = true}, 50);
    //мы отправляем sendData в false при отправке данных.
    movePlayer.sendData = false;

    //Make a new pointer with the new inputs from the client.
    //contains player positions in server
    var serverPointer = {
        x: data.pointer_x,
        y: data.pointer_y,
        worldX: data.pointer_worldx,
        worldY: data.pointer_worldy
    }

    //Перемещение пользователя
    if (physicsPlayer.distanceToPointer(movePlayer, serverPointer) <= 30) {
        movePlayer.playerBody.angle = physicsPlayer.movetoPointer(movePlayer, 0, serverPointer, 1000);
    } else {
        movePlayer.playerBody.angle = physicsPlayer.movetoPointer(movePlayer, movePlayer.speed, serverPointer);
    }

    movePlayer.x = movePlayer.playerBody.position[0];
    movePlayer.y = movePlayer.playerBody.position[1];

    //new player position to be sent back to client.
    var info = {
        x: movePlayer.playerBody.position[0],
        y: movePlayer.playerBody.position[1],
        angle: movePlayer.playerBody.angle
    }

    //Отправить отправителю его координаты
    this.emit('input_recieved', info);

    //Данный о координатах отправителя для всех пользоваелей кроме отправителя
    var moveplayerData = {
        id: movePlayer.id,
        x: movePlayer.playerBody.position[0],
        y: movePlayer.playerBody.position[1],
        angle: movePlayer.playerBody.angle,
        size: movePlayer.size
    }

    //для всех пользователй кроме отправителя
    this.broadcast.emit('enemy_move', moveplayerData);
}

//Функция столкновений
function onPlayerCollision (data) {
    var movePlayer = find_playerid(this.id);
    var enemyPlayer = find_playerid(data.id);


    if (movePlayer.dead || enemyPlayer.dead)
        return

    if (!movePlayer || !enemyPlayer)
        return


    if (movePlayer.size == enemyPlayer)
        return
    //размер основного игрока меньше размера противника
    else if (movePlayer.size < enemyPlayer.size) {
        var gained_size = movePlayer.size / 2;
        enemyPlayer.size += gained_size;
        this.emit("killed");
        //Отправить всем кроме пользователя информацию о том что его схели
        this.broadcast.emit('remove_player', {id: this.id});
        //Увеличиваем размеры противника
        this.broadcast.to(data.id).emit("gained", {new_size: enemyPlayer.size});
        //Удаляем игрока
        playerKilled(movePlayer);
    } else {
        var gained_size = enemyPlayer.size / 2;
        movePlayer.size += gained_size;
        this.emit('remove_player', {id: enemyPlayer.id});
        this.emit("gained", {new_size: movePlayer.size});
        this.broadcast.to(data.id).emit("killed");
        //send to everyone except sender.
        this.broadcast.emit('remove_player', {id: enemyPlayer.id});
        playerKilled(enemyPlayer);
    }

    console.log("someone ate someone!!!");
}

function find_food (id) {
    for (var i = 0; i < game_instance.food_pickup.length; i++) {
        if (game_instance.food_pickup[i].id == id) {
            return game_instance.food_pickup[i];
        }
    }

    return false;
}

function onitemPicked (data) {
    var movePlayer = find_playerid(this.id);

    var object = find_food(data.id);
    if (!object) {
        console.log(data);
        console.log("could not find object");
        return;
    }

    //Увеличиваем размер игроа
    movePlayer.size += 3;
    //отправляем информацию об увеличении
    this.emit("gained", {new_size: movePlayer.size});

    //Очищаем на элемент массив с едой
    game_instance.food_pickup.splice(game_instance.food_pickup.indexOf(object), 1);
    //Отправить всем информацию о том что обект с едой удален
    io.emit('itemremove', object);

    //this.emit('item_picked');
}

function playerKilled (player) {
    player.dead = true;
}

function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

//Удалить отключенного пользователя
function onClientdisconnect() {
    console.log('disconnect');

    var removePlayer = find_playerid(this.id);

    if (removePlayer) {
        player_lst.splice(player_lst.indexOf(removePlayer), 1);
    }

    console.log("removing player " + this.id);

    //Сообщить всем о том что пользователь удален
    this.broadcast.emit('remove_player', {id: this.id});

}

// Найти пользователя по id
function find_playerid(id) {

    for (var i = 0; i < player_lst.length; i++) {

        if (player_lst[i].id == id) {
            return player_lst[i];
        }
    }

    return false;
}

// io connection
var io = require('socket.io')(serv,{});

io.sockets.on('connection', function(socket){
    console.log("socket connected");

    // listen for disconnection;
    socket.on('disconnect', onClientdisconnect);

    // listen for new player
    socket.on("new_player", onNewplayer);
    /*
     //we dont need this anymore
     socket.on("move_player", onMovePlayer);
     */
    //listen for new player inputs.
    socket.on("input_fired", onInputFired);

    socket.on("player_collision", onPlayerCollision);

    //listen if player got items
    socket.on('item_picked', onitemPicked);
});