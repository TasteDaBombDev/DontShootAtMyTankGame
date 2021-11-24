let LobbyBase = require('./LobbyBase')
let GameLobbySettings = require('./GameLobbySettings')
let Connection = require('../Connection')
let Bullet = require('../Bullet')
let LobbyState = require('../Utility/LobbyState')
let Vector2 = require('../Vector2')
let ServerItem = require('../Utility/ServerItem')
let AIBase = require('../AI/AIBase')
let TankAI = require('../AI/TankAI')

module.exports = class GameLobbby extends LobbyBase {
    constructor(settings = GameLobbySettings) {
        super();
        this.settings = settings;
        this.lobbyState = new LobbyState();
        this.bullets = [];
        this.endGameLobby = function() {};
    }

    onUpdate() {
        super.onUpdate();

        let lobby = this;
        let serverItems = lobby.serverItems; 
        
        let aiList = serverItems.filter(item => {return item instanceof AIBase;});
        aiList.forEach(ai => {
            ai.onObtainTarget(lobby.connections);

            ai.onUpdate(data => {
                lobby.connections.forEach(connection => {
                    let socket = connection.socket;
                    socket.emit('updateAI', data);
                });
            }, (data) => {
                lobby.onFireBullet(undefined, data, true);
            });
        });

        lobby.updateBullets();
        lobby.updateDeadPlayers();

        if (lobby.connections.length == 0) {
            lobby.endGameLobby();
        }
    }

    canEnterLobby(connection = Connection) {
        let lobby = this;
        let maxPlayerCount = lobby.settings.maxPlayers;
        let currentPlayerCount = lobby.connections.length;

        if(currentPlayerCount + 1 > maxPlayerCount) {
            return false;
        }

        return true;
    }

    onEnterLobby(connection = Connection) {
        let lobby = this;
        let socket = connection.socket;

        super.onEnterLobby(connection);


        if (lobby.connections.length == lobby.settings.maxPlayers) {
            console.log('We have enough players we can start the game');
            lobby.lobbyState.currentState = lobby.lobbyState.GAME;
            lobby.onSpawnAllPlayersIntoGame();
        }

        let returnData = {
            state: lobby.lobbyState.currentState
        };

        socket.emit('loadGame');
        socket.emit('lobbyUpdate', returnData);
        socket.broadcast.to(lobby.id).emit('lobbyUpdate', returnData);
    }

    onLeaveLobby(connection = Connection) {
        let lobby = this;

        super.onLeaveLobby(connection);

        lobby.removePlayer(connection);

        lobby.onUnspawnAllAIInGame(connection);

        if (lobby.connections.length < lobby.settings.minPlayers) {
            lobby.connections.forEach(connection => {
                if (connection != undefined) {
                    connection.socket.emit('unloadGame');
                    connection.server.onSwitchLobby(connection, connection.server.generalServerID);
                }
            });
        }
    }

    onSpawnAllPlayersIntoGame() {
        let lobby = this;
        let connections = lobby.connections;

        connections.forEach(connection => {
            lobby.addPlayer(connection);
        });
    }

    onSpawnAIIntoGame() {
        let lobby = this;
        lobby.onServerSpawn(new TankAI(), new Vector2(-6, 2));
    }

    onUnspawnAllAIInGame(connection = Connection) {
        let lobby = this;
        let serverItems = lobby.serverItems;

        serverItems.forEach(serverItem => {
            connection.socket.emit('serverUnspawn', {
                id: serverItem.id
            });
        });
    }

    updateBullets() {
        let lobby = this;
        let bullets = lobby.bullets;
        let connections = lobby.connections;

        bullets.forEach(bullet => {
            let isDestroyed = bullet.onUpdate();

            if(isDestroyed) {
                lobby.despawnBullet(bullet);
            }
        });
    }

    updateDeadPlayers() {
        let lobby = this;
        let connections = lobby.connections;

        connections.forEach(connection => {
            let player = connection.player;

            if(player.isDead) {
                let isRespawn = player.respawnCounter();
                if(isRespawn) {
                    let socket = connection.socket;
                    let returnData = {
                        id: player.id,
                        position: lobby.getRandomSpawn()
                    }

                    socket.emit('playerRespawn', returnData);
                    socket.broadcast.to(lobby.id).emit('playerRespawn', returnData);
                }
            }
        });

        let aiList = lobby.serverItems.filter(item => {return item instanceof AIBase;});
        aiList.forEach(ai => {
            if(ai.isDead) {
                let isRespawn = ai.respawnCounter();
                if(isRespawn) {
                    let socket = connections[0].socket;
                    let returnData = {
                        id: ai.id,
                        position: {
                            x: ai.position.x,
                            y: ai.position.y
                        }
                    }

                    socket.emit('playerRespawn', returnData);
                    socket.broadcast.to(lobby.id).emit('playerRespawn', returnData);
                }
            }
        });
    }

    onFireBullet(connection = Connection, data, isAI = false) {
        let lobby = this;

        let bullet = new Bullet();
        bullet.name = 'Bullet';
        bullet.activator = data.activator;
        bullet.position.x = data.position.x;
        bullet.position.y = data.position.y;
        bullet.direction.x = data.direction.x;
        bullet.direction.y = data.direction.y;

        lobby.bullets.push(bullet);

        var returnData = {
            name: bullet.name,
            id: bullet.id,
            activator: bullet.activator,
            position: {
                x: bullet.position.x,
                y: bullet.position.y
            },
            direction: {
                x: bullet.direction.x,
                y: bullet.direction.y
            },
            speed: bullet.speed
        }

        if (!isAI) {
            connection.socket.emit('serverSpawn', returnData);
            connection.socket.broadcast.to(lobby.id).emit('serverSpawn', returnData); 
        } else if (lobby.connections.length > 0) {
            lobby.connections[0].socket.emit('serverSpawn', returnData);
            lobby.connections[0].socket.broadcast.to(lobby.id).emit('serverSpawn', returnData); 
        }        
    }

    onCollisionDestroy(connection = Connection, data) {
        let lobby = this;

        let returnBullets = lobby.bullets.filter(bullet => {
            return bullet.id == data.id
        });

        returnBullets.forEach(bullet => {
            let playerHit = false;

            lobby.connections.forEach(c => {
                let player = c.player;

                if(bullet.activator != player.id) {
                    let distance = bullet.position.Distance(player.position);

                    if(distance < 0.8) {
                        let isDead = player.dealDamage(50);
                        if(isDead) {
                            console.log('Player with id: ' + player.id + ' has died');
                            let returnData = {
                                id: player.id
                            }
                            c.socket.emit('playerDied', returnData);
                            c.socket.broadcast.to(lobby.id).emit('playerDied', returnData);
                        } else {
                            console.log('Player with id: ' + player.id + ' has (' + player.health + ') health left');
                        }
                        playerHit = true;
                        lobby.despawnBullet(bullet);
                    }
                }
            });

            if (!playerHit) {
                let aiList = lobby.serverItems.filter(item => {return item instanceof AIBase;});
                aiList.forEach(ai => {
                    if (bullet.activator != ai.id) {
                        let distance = bullet.position.Distance(ai.position);

                        if (distance < 0.8) {
                            let isDead = ai.dealDamage(50);
                            if (isDead) {
                                console.log('Ai has died');
                                let returnData = {
                                    id: ai.id
                                }
                                lobby.connections[0].socket.emit('playerDied', returnData);
                                lobby.connections[0].socket.broadcast.to(lobby.id).emit('playerDied', returnData);
                            } else {
                                console.log('AI with id: ' + ai.id + ' has (' + ai.health + ') health left');
                            }
                        }
                        playerHit = true;
                        lobby.despawnBullet(bullet);
                    }
                });
            }

            if(!playerHit) {
                bullet.isDestroyed = true;
            }
        });        
    }

    despawnBullet(bullet = Bullet) {
        let lobby = this;
        let bullets = lobby.bullets;
        let connections = lobby.connections;

        console.log('Destroying bullet (' + bullet.id + ')');
        var index = bullets.indexOf(bullet);
        if(index > -1) {
            bullets.splice(index, 1);

            var returnData = {
                id: bullet.id
            }

            connections.forEach(connection => {
                connection.socket.emit('serverUnspawn', returnData);
            });
        }
    }

    addPlayer(connection = Connection) {
        let lobby = this;
        let connections = lobby.connections;
        let socket = connection.socket;

        let randomPosition = lobby.getRandomSpawn();
        connection.player.position = new Vector2(randomPosition.x, randomPosition.y);

        var returnData = {
            id: connection.player.id,
            position: connection.player.position
        }

        socket.emit('spawn', returnData); 
        socket.broadcast.to(lobby.id).emit('spawn', returnData); 

        connections.forEach(c => {
            if(c.player.id != connection.player.id) {
                socket.emit('spawn', {
                    id: c.player.id,
                    position: c.player.position
                });
            }
        });
    }

    removePlayer(connection = Connection) {
        let lobby = this;

        connection.socket.broadcast.to(lobby.id).emit('disconnected', {
            id: connection.player.id
        });
    }

    getRandomSpawn() {
        let lobby = this;
        let index = lobby.getRndInteger(0, lobby.settings.levelData.freeForAllSpawn.length);

        return {
            x: lobby.settings.levelData.freeForAllSpawn[index].position.x,
            y: lobby.settings.levelData.freeForAllSpawn[index].position.y
        }
    }

    getRndInteger(min, max) {
        return Math.floor(Math.random() * (max - min)) + min;
    }
}