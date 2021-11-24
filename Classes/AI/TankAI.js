let AIBase = require('../AI/AIBase')
let Vector2 = require('../Vector2')

module.exports = class TankAI extends AIBase {
    constructor() {
        super();
        this.username = "AI_Tank";

        this.target;
        this.hasTarget = false;

        this.rotation = 0;

        this.canShoot = false;
        this.currentTime = Number(0);
        this.reloadTime = Number(3);
    }

    onUpdate(onUpdateAI, onFireBullet) {
        let ai = this;

        if (!ai.hasTarget) {
            return;
        }

        let targetConnection = ai.target;
        let targetPosition = targetConnection.player.position;

        let direction = new Vector2();
        direction.x = targetPosition.x - ai.position.x;
        direction.y = targetPosition.y - ai.position.y;
        direction = direction.Normalized();

        let distance = ai.position.Distance(targetPosition);

        let rotation = Math.atan2(direction.y, direction.x) * ai.radiansToDegrees();

        if (isNaN(rotation)) {
            return;
        }

        let angleAmount = ai.getAngleDifference(ai.rotation, rotation); 
        let angleStep = angleAmount * ai.rotationSpeed; 
        ai.rotation = ai.rotation + angleStep; 
        let forwardDirection = ai.getForwardDirection();

        if (ai.canShoot) {
            onFireBullet({
                activator: ai.id,
                position: ai.position.JSONData(),
                direction: direction.JSONData()
            });
            ai.canShoot = false;
            ai.currentTime = Number(0);
        } else {
            ai.currentTime = Number(ai.currentTime) + Number(0.1);
            if (ai.currentTime >= ai.reloadTime) {
                ai.canShoot = true;
            }
        }

        if (Math.abs(angleAmount) < 10) {
            if (distance > 3.5) {
                ai.position.x = ai.position.x + forwardDirection.x * ai.speed;
                ai.position.y = ai.position.y + forwardDirection.y * ai.speed;
            } else if (distance <= 2.5) {
                ai.position.x = ai.position.x - forwardDirection.x * ai.speed;
                ai.position.y = ai.position.y - forwardDirection.y * ai.speed;
            }
        }

        onUpdateAI({
            id: ai.id,
            position: ai.position.JSONData(),
            tankRotation: ai.rotation,
            barrelRotation: rotation
        });
    }

    onObtainTarget(connections) {
        let ai = this;
        let foundTarget = false;
        ai.target = undefined;

        let availableTargets = connections.filter(connection => {
            let player = connection.player;
            return ai.position.Distance(player.position) < 10;
        });

        availableTargets.sort((a, b) => {
            let aDistance = ai.position.Distance(a.player.position);
            let bDistance = ai.position.Distance(b.player.position);
            return (aDistance < bDistance) ? -1 : 1;
        });

        if (availableTargets.length > 0) {
            foundTarget = true;
            ai.target = availableTargets[0];
        }

        ai.hasTarget = foundTarget;
    }

    getForwardDirection() {
        let ai = this;

        let radiansRotation = (ai.rotation + 90) * ai.degreesToRadians();
        let sin = Math.sin(radiansRotation);
        let cos = Math.cos(radiansRotation);

        let worldUpVector = ai.worldUpVector();
        let tx = worldUpVector.x;
        let ty = worldUpVector.y;

        return new Vector2((cos * tx) - (sin * ty), (sin * tx) + (cos * ty));
    }
}