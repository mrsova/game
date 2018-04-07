var socket; // Определяем глобалную переменную сокет
socket = io.connect(); // отправить запрос на подключение к серверу

//Настройка размера экрана
//to the browser
canvas_width = window.innerWidth * window.devicePixelRatio;
canvas_height = window.innerHeight * window.devicePixelRatio;

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

function createPlayer () {
    //Используем объект графики
    player = game.add.graphics(0, 0);
    //Задаем радиус
    player.radius = 100;
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
    player.body_size = player.radius;

    // Создаем объект. второй параметр включает режим отладки
    game.physics.p2.enableBody(player, true);
    //Добавлем объект в боди
    player.body.addCircle(player.body_size, 0 , 0);
}

// Добавить
main.prototype = {
    preload: function() {
        game.stage.disableVisibilityChange = true;
        game.scale.scaleMode = Phaser.ScaleManager.RESIZE;
        game.world.setBounds(0, 0, gameProperties.gameWidth, gameProperties.gameHeight, false, false, false, false);
        //Физическая система
        game.physics.startSystem(Phaser.Physics.P2JS);
        game.physics.p2.setBoundsToWorld(false, false, false, false, false);
        //Устанавливает силу тяжести равной нулю
        game.physics.p2.gravity.y = 0;
        // Отключить гравитацию
        game.physics.p2.applyGravity = false;
        game.physics.p2.enableBody(game.physics.p2.walls, false);
        // Включить обнаружение столкновений
        game.physics.p2.setImpactEvents(true); 
    },

    //Функция запускается при запуске игры
    create: function () {
        game.stage.backgroundColor = 0xE1A193;
        game.input.onUp.add(this.changePos, this);
        console.log("client started");
        //listen if a client successfully makes a connection to the server,
        //and call onsocketConnected
        socket.on("connect", onsocketConnected);
        // //listen to new enemy connections
        socket.on("new_enemyPlayer", onNewPlayer);
        //listen to enemy movement
        socket.on("enemy_move", onEnemyMove);
        // when received remove_player, remove the player passed;
        socket.on('remove_player', onRemovePlayer);

    },
    //При обновлении
    update: function () {
        //Если игра иницилизована
        if (gameProperties.in_game) {
        
            // получаем положение мышки
            var pointer = game.input.mousePointer;
        
            //Дистанция до мышки
            if (distanceToPointer(player, pointer) <= 50) {
                //The player can move to mouse pointer at a certain speed.
                //look at player.js on how this is implemented.
                movetoPointer(player, 0, pointer, 100);
            } else {
                movetoPointer(player, 500, pointer);
            }
        
            //Отправить на сервер координаты передвижения игрока
            socket.emit('move_player', {x: player.x, y: player.y, angle: player.angle});
        }
    },
    changePos:function(p)
    {
        //Если игра иницилизована
        if (gameProperties.in_game) {

            // получаем положение мышки
            var pointer = p;

            //Дистанция до мышки
            if (distanceToPointer(player, pointer) <= 50) {
                //The player can move to mouse pointer at a certain speed.
                //look at player.js on how this is implemented.
                movetoPointer(player, 0, pointer, 100);
            } else {
                movetoPointer(player, 500, pointer);
            }

            //Отправить на сервер координаты передвижения игрока
            socket.emit('move_player', {x: player.x, y: player.y, angle: player.angle});
        }
    }
}



// this is the enemy class.
var remote_player = function (id, startx, starty, start_angle) {
    this.x = startx;
    this.y = starty;
    //this is the unique socket id. We use it as a unique name for enemy
    this.id = id;
    this.angle = start_angle;

    this.player = game.add.graphics(this.x , this.y);
    this.player.radius = 100;

    // set a fill and line style
    this.player.beginFill(0xffd900);
    this.player.lineStyle(2, 0xffd900, 1);
    this.player.drawCircle(0, 0, this.player.radius * 2);
    this.player.endFill();
    this.player.anchor.setTo(0.5,0.5);
    this.player.body_size = this.player.radius;

    // draw a shape
    game.physics.p2.enableBody(this.player, true);
    this.player.body.clearShapes();
    this.player.body.addCircle(this.player.body_size, 0 , 0);
    this.player.body.data.shapes[0].sensor = true;
}

// Функция при коннекте игрока к серверу
function onsocketConnected () {
    //Создаем нового игрока
    createPlayer();
    gameProperties.in_game = true;
    //отправьте серверу нашу начальную позицию и сообщите, что мы подключены
    socket.emit('new_player', {x: 0, y: 0, angle: 0});
}

//Удалить польователя который вышел
function onRemovePlayer (data) {
    var removePlayer = findplayerbyid(data.id);
    // Player not found
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
    //console.log(data);
    //enemy object
    var new_enemy = new remote_player(data.id, data.x, data.y, data.angle);
    enemies.push(new_enemy);
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
    //console.log(data.id);
    //console.log(enemies);
    var movePlayer = findplayerbyid (data.id);

    if (!movePlayer) {
        return;
    }
    movePlayer.player.body.x = data.x;
    movePlayer.player.body.y = data.y;
    movePlayer.player.angle = data.angle;
}

// Обернть игровые состояния
var gameBootstrapper = {
    init: function(gameContainerElementId){
        game.state.add('main', main);
        game.state.start('main');
    }
};

//call the init function in the wrapper and specifiy the division id
gameBootstrapper.init("gameDiv");