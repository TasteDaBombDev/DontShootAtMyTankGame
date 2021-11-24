module.exports = class LobbyState {
    constructor() {
        this.GAME = 'Game';
        this.LOBBY = 'Lobby';
        this.ENDGAME = 'EndGame';

        this.currentState = this.LOBBY;

    }
}