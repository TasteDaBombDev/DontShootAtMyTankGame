let ServerItem = require('../Utility/ServerItem')
let Vector2 = require('../Vector2')

module.exports = class AIBase extends ServerItem {
    constructor() {
        super();
        this.username = "AI_Base";
        this.health = new Number(100);
        this.isDead = false;
        this.respawnTicker = new Number(0);
        this.respawnTime = new Number(0);
        this.speed = 0.1;
        this.rotationSpeed = 0.1;
    }

    onObtainTarget(connections) {         
    }

    respawnCounter() {
        this.respawnTicker = this.respawnTicker + 1;

        if(this.respawnTicker >= 10) {
            this.respawnTicker = new Number(0);
            this.respawnTime = this.respawnTime + 1;

            if(this.respawnTime >= 3) {
                console.log('Respawning AI: ' + this.id);
                this.isDead = false;
                this.respawnTicker = new Number(0);
                this.respawnTime = new Number(0);
                this.health = new Number(100);
                this.position = new Vector2(-7, 3);

                return true;
            }
        }

        return false;
    }

    dealDamage(amount = Number) {
        this.health = this.health - amount;

        if(this.health <= 0 ) {
            this.isDead = true;
            this.respawnTicker = new Number(0);
            this.respawnTime = new Number(0);
        }

        return this.isDead;
    }

    radiansToDegrees() {
        return new Number(57.29578); 
    }

    degreesToRadians() {
        return new Number(0.01745329);
    }

    worldUpVector() {
        return new Vector2(0, -1);
    }

    getAngleDifference(one, two) {
        let diff = (two - one + 180) % 360 - 180;
        return diff < -180 ? diff + 360 : diff;
    }
}