//При столкновении игроков
function player_coll (body, bodyB, shapeA, shapeB, equation) {
	console.log("collision");
	
	//Идентификатор тела с которым игрок установил контакт
	var key = body.sprite.id;
	//Тип тела
	var type = body.sprite.type;

	if (type == "player_body") {
		//Отправить столкновение игрока
		socket.emit('player_collision', {id: key});
	}
	else if (type == "food_body") {
		console.log("items food");
		socket.emit('item_picked', {id: key});
	}
}