var socket; // Определяем глобалную переменную сокет
socket = io.connect(); // отправить запрос на подключение к серверу

//Настройка размера экрана
//to the browser
canvas_width = window.innerWidth * window.devicePixelRatio;
canvas_height = window.innerHeight * window.devicePixelRatio;
//canvas_width = 960;
//canvas_height = 960;


//Создаем объект игры
game = new Phaser.Game(canvas_width, canvas_height, Phaser.CANVAS,'gameDiv');


var enemies = [];

var gameProperties = {
    //Фактические размеры игры
    gameWidth: 4000,
    gameHeight: 4000,
    game_elemnt: "gameDiv",
    in_game: false
};

// Основное игровое состояние
var main = function(game){

};

function createPlayer (data) {
    //Используем объект графики
    player = game.add.graphics(getRndInteger(10, 50),getRndInteger(10, 50));
    //Задаем радиус
    player.radius = data.size;
    //Задаем объект
    player.beginFill(0xffd900);
    //Задаем параметриы линии
    player.lineStyle(2, 0xffd900, 1);
    //Рисуем круг
    player.drawCircle(0, 0, player.radius * 2);
    //Заканчиваем рисование
    player.endFill();
    //Устанавливаем точку в цетрне тяжести объекта
    player.anchor.setTo(0.5,0.5);

    //Устанавливаем начальтный размер и радиус
    player.body_size = player.radius;
    player.initial_size = player.radius;
    var style = { font: "bold 16px Arial", fill: "#000", boundsAlignH: "center", boundsAlignV: "middle"};
    player.type = "player_body";

    // Создаем объект. второй параметр включает режим отладки
    game.physics.p2.enableBody(player, false);
    player.body.clearShapes();
    player.body.addCircle(player.body_size, 0 , 0);
    player.body.data.shapes[0].sensor = true;
    //Разрешить столкновение с други телом
    player.body.onBeginContact.add(player_coll, this);
    player.playertext = game.add.text(-10, -15, data.username , style);
    player.addChild(player.playertext);
    //Для того чтобы камера следила за игроком
    game.camera.follow(player, Phaser.Camera.FOLLOW_TOPDOWN_TIGHT, 0.1, 0.1);

}



//Враг физика
var remote_player = function (id, startx, starty, startSize, start_angle,username) {
    this.x = startx;
    this.y = starty;
    //это уникальный идентификатор сокета. Мы используем его как уникальное имя для врага
    this.id = id;
    this.angle = start_angle;

    this.player = game.add.graphics(this.x , this.y);
    //инициализировать размер с помощью значения сервера
    this.player.radius = startSize;
    var style = { font: "bold 16px Arial", fill: "#000", boundsAlignH: "center", boundsAlignV: "middle" };
    // установить стиль заливки и линии
    this.player.beginFill(0xffd900);
    this.player.lineStyle(2, 0xffd900, 1);
    this.player.drawCircle(0, 0, this.player.radius * 2);
    this.player.endFill();
    this.player.anchor.setTo(0.5,0.5);

    //Устанавливаем начальный размер
    this.initial_size = startSize;
    //Устанавливаем размер тела и радиус игрока
    this.player.body_size = this.player.radius;

    this.player.type = "player_body";
    this.player.id = this.id;

    // нарисовать форму
    game.physics.p2.enableBody(this.player, false);
    this.player.body.clearShapes();
    this.player.body.addCircle(this.player.body_size, 0 , 0);
    console.log(username);
    this.player.playertext = game.add.text(-10, -15, username , style);
    this.player.addChild(this.player.playertext);
    this.player.body.data.shapes[0].sensor = true;

}



function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

// Функция при коннекте игрока к серверу
function onsocketConnected (data) {
    //Создаем нового игрока
    gameProperties.in_game = true;
    var username = data.username;
    //отправьте серверу нашу начальную позицию и сообщите, что мы подключены
    socket.emit('new_player', {username: data.username, x: 0, y: 0, angle: 0});
}

//Получаем рассчетную позицию игрока с сервера
function onInputRecieved(data) {

    //Формируем новый указатель с позицией
    var newPointer = {
        x: data.x,
        y: data.y,
        worldX: data.x,
        worldY: data.y
    }

    var distance = distanceToPointer(player, newPointer);
    // мы получаем позицию игрока каждые 50 мс. Мы интерполируем
    // между текущей позицией и новой позицией, чтобы игрок
    // делал рывок.
    speed = distance/0.05;

    //Переводим игрока в новое положение
    player.rotation = movetoPointer(player, speed, newPointer);

}


//Удалить польователя который вышел
function onRemovePlayer (data) {
    var removePlayer = findplayerbyid(data.id);
    if (!removePlayer) {
        console.log('Player not found: ', data.id);
        return;
    }
    //Удалем объект пользователя
    removePlayer.player.destroy();
    //Удаляем пользователя из массива
    enemies.splice(enemies.indexOf(removePlayer), 1);
}

//Сервер сообщает о подключенному к игре игроку
//Создаем врага в игре
function onNewPlayer (data) {
    console.log(data.username);
    var new_enemy = new remote_player(data.id, data.x, data.y, data.size, data.angle,data.username);
    enemies.push(new_enemy);
    console.log(new_enemy);
}

//Ищем пользователя по id
function findplayerbyid (id) {
    for (var i = 0; i < enemies.length; i++) {
        if (enemies[i].id == id) {
            return enemies[i];
        }
    }
}

// Сервер говорит нам, что есть новое движение врагов. Мы находим перемещенного врага
// и синхронизируем движение противника с сервером
function onEnemyMove (data) {
    console.log("moving enemy");

    var movePlayer = findplayerbyid (data.id);

    if (!movePlayer) {
        return;
    }

    var newPointer = {
        x: data.x,
        y: data.y,
        worldX: data.x,
        worldY: data.y
    }

    //console.log(data);

    //Проверить отличается ли размер сервера с клиентским
    if (data.size != movePlayer.player.body_size) {
        movePlayer.player.body_size = data.size;
        var new_scale = movePlayer.player.body_size / movePlayer.initial_size;
        movePlayer.player.scale.set(new_scale);
        movePlayer.player.body.clearShapes();
        movePlayer.player.body.addCircle(movePlayer.player.body_size, 0 , 0);
        movePlayer.player.body.data.shapes[0].sensor = true;
    }

    var distance = distanceToPointer(movePlayer.player, newPointer);
    speed = distance/0.05;

    movePlayer.rotation = movetoPointer(movePlayer.player, speed, newPointer);
}

function onGained (data) {
    player.body_size = data.new_size;
    var new_scale = data.new_size/player.initial_size;
    player.scale.set(new_scale);
    //create new body
    player.body.clearShapes();
    player.body.addCircle(player.body_size, 0 , 0);
    player.body.data.shapes[0].sensor = true;
}

function onKilled (data) {
    player.destroy();
}


//create leader board in here.
function createLeaderBoard() {
    var leaderBox = game.add.graphics(game.width * 0.81, game.height * 0.05);
    leaderBox.fixedToCamera = true;
    // draw a rectangle
    leaderBox.beginFill(0xD3D3D3, 0.3);
    leaderBox.lineStyle(2, 0x202226, 1);
    leaderBox.drawRect(0, 0, 300, 400);
    leaderBox.anchor.set(0.5);

    var style = { font: "13px Press Start 2P", fill: "black", align: "left", fontSize: '22px'};

    leader_text = game.add.text(10, 10, "", style);
    leader_text.anchor.set(0);

    leaderBox.addChild(leader_text);
}

//leader board
function lbupdate (data) {
    //this is the final board string.
    var board_string = "";
    var maxlen = 10;
    var maxPlayerDisplay = 10;
    var mainPlayerShown = false;

    for (var i = 0;  i < data.length; i++) {
        //if the mainplayer is shown along the iteration, set it to true

        if (mainPlayerShown && i >= maxPlayerDisplay) {
            break;
        }

        //if the player's rank is very low, we display maxPlayerDisplay - 1 names in the leaderboard
        // and then add three dots at the end, and show player's rank.
        if (!mainPlayerShown && i >= maxPlayerDisplay - 1 && socket.id == data[i].id) {
            board_string = board_string.concat(".\n");
            board_string = board_string.concat(".\n");
            board_string = board_string.concat(".\n");
            mainPlayerShown = true;
        }

        //here we are checking if user id is greater than 10 characters, if it is
        //it is too long, so we're going to trim it.
        if (data[i].username.length >= 10) {
            var username = data[i].username;
            var temp = "";
            for (var j = 0; j < maxlen; j++) {
                temp += username[j];
            }

            temp += "...";
            username = temp;

            //change to player username instead of id.
            board_string = board_string.concat(i + 1,": ");
            board_string = board_string.concat(username," ",(data[i].size).toString() + "\n");

        } else {
            board_string = board_string.concat(i + 1,": ");
            board_string = board_string.concat(data[i].username," ",(data[i].size).toString() + "\n");
        }

    }

    console.log(board_string);
    leader_text.setText(board_string);
}


// Добавить
main.prototype = {
    init: function(username) {
        // when the socket connects, call the onsocketconnected and send its information to the server
        socket.emit('logged_in', {username: username});

        // when the player enters the game
        socket.on('enter_game', onsocketConnected);
    },
    preload: function() {
        //Включить реальное время
        game.stage.disableVisibilityChange = true;
        game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
        //game.world.setBounds(0, 0, gameProperties.gameWidth, gameProperties.gameHeight, false, false, false, false);
        game.world.setBounds(-1000, -1000, 4000, 4000);
        //Физическая система
        game.physics.startSystem(Phaser.Physics.P2JS);
        game.physics.p2.setBoundsToWorld(false, false, false, false, false);

        //Устанавливает силу тяжести равной нулю
        game.physics.p2.gravity.y = 0;
        // Отключить гравитацию
        game.physics.p2.applyGravity = false;
        game.physics.p2.enableBody(game.physics.p2.walls, false);
        // Включить обнаружение столкновений
        //game.physics.p2.setImpactEvents(true);
    },

    //Функция запускается при запуске игры
    create: function () {
        // move our camera half the size of the viewport back so the pivot point is in the center of our view
        // worldScale = Phaser.Math.clamp(0, 0.25, 2);
        // game.world.scale.set(worldScale);
        // game.camera.x = (game.width * -0.12);
        // game.camera.y = (game.height * -0.12);

        game.stage.backgroundColor = 0xE1A193;
        //game.input.onDown.add(this.update, this);
        console.log("client started");

        socket.on("create_player", createPlayer);
        // //listen to new enemy connections
        socket.on("new_enemyPlayer", onNewPlayer);
        //listen to enemy movement
        socket.on("enemy_move", onEnemyMove);
        // when received remove_player, remove the player passed;
        socket.on('remove_player', onRemovePlayer);
        //Когда игрок получает новый вход
        socket.on('input_recieved', onInputRecieved);
        //when the player gets killed
        socket.on('killed', onKilled);
        //when the player gains in size
        socket.on('gained', onGained);
        // check for item removal
        socket.on ('itemremove', onitemremove);
        // check for item update
        socket.on('item_update', onitemUpdate);
        socket.on ('leader_board', lbupdate);

        createLeaderBoard();


    },
    //При обновлении
    update: function () {
        // //Если игра иницилизована
        if (gameProperties.in_game) {

            // получаем положение мышки
            var pointer = game.input.mousePointer;

            //Отправка информации о местоположении на сервер
            socket.emit('input_fired', {
                pointer_x: pointer.x,
                pointer_y: pointer.y,
                pointer_worldx: pointer.worldX,
                pointer_worldy: pointer.worldY
            });
        }
    },
    render: function(){
        game.debug.cameraInfo(game.camera, 32, 32);
    }
}




// Обернть игровые состояния
var gameBootstrapper = {
    init: function(gameContainerElementId){
        game.state.add('main', main);
        game.state.add('login', login);
        game.state.start('login');
    }
};

//call the init function in the wrapper and specifiy the division id
gameBootstrapper.init("gameDiv");