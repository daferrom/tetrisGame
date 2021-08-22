class Game {
    // Square length in pixels
    static SQUARE_LENGTH = screen.width > 420 ? 30 : 40;
    static COLUMNS = 10;
    static ROWS = 16;
    static CANVAS_WIDTH = this.SQUARE_LENGTH * this.COLUMNS;
    static CANVAS_HEIGHT = this.SQUARE_LENGTH * this.ROWS;
    static EMPTY_COLOR = "#565656";
    static BORDER_COLOR = "777777";
    static DELETED_ROW_COLOR = "red";
    // When a piece collapses with something at its bottom, how many time wait for putting another piece? (in ms)
    static TIMEOUT_LOCK_PUT_NEXT_PIECE = 300;
    // Speed of falling piece (in ms)
    static PIECE_SPEED = 500;
    // Animation time when a row is being deleted
    static DELETE_ROW_ANIMATION = 500;
    // Score to add when a square dissapears (for each square)
    static PER_SQUARE_SCORE = 1;
    static COLORS = [
        "#ffd300",
        "#de38c8",
        "#652ec7",
        "#33135c",
        "#13ca91",
        "#ff9472",
        "#35212a",
        "#ff8b8b",
        "#28cf75",
        "#00a9fe",
        "#04005e",
        "#120052",
        "#272822",
        "#f92672",
        "#66d9ef",
        "#a6e22e",
        "#fd971f",
    ];


    constructor(canvasId) {
        this.canvasId = canvasId;
        this.timeoutFlag = false;
        this.board = [];
        this.existingPieces = [];
        this.globalX = 0;
        this.globalY = 0;
        this.paused = true;
        this.currentFigure = null;
        this.canPlay = false;
        this.intervalId = null;
        this.init();
    }
//Invoce the necessary functions to start the game//
    init() {
        this.showWelcome();
        this.initDomElements();
        this.resetGame();
        this.draw();
        this.initControls();
    }
//the function to reset the game//
    resetGame() {
        this.score = 0;
        this.initBoardAndExistingPieces();
        this.chooseRandomFigure();
        this.restartGlobalXAndY();
        this.syncExistingPiecesWithBoard();
        this.refreshScore();
        this.pauseGame();
    }
    //shows the welcome with a sweetalert//
    showWelcome() {
        Swal.fire("Bienvenido", `
            <br>
            <strong>Controles:</strong>
            <ul class="list-group">
            <li class="list-group-item"> <kbd>P</kbd><br>Pausar o reanudar </li>
            <li class="list-group-item"> <kbd>R</kbd><br>Rotar</li>
            <li class="list-group-item"> <kbd>Flechas de dirección</kbd><br>Mover figura hacia esa dirección</li>
            </ul>
            <br>`);
    }

    // configuration of controls of the game//
    initControls() {
        document.addEventListener("keydown", (e) => {
            const { code } = e;
            if (!this.canPlay && code !== "KeyP") {
                return;
            }
            // functions to verify the attemp of movement of the piece//
            switch (code) {
                case "ArrowRight":
                    this.attemptMoveRight();
                    break;
                case "ArrowLeft":
                    this.attemptMoveLeft();
                    break;
                case "ArrowDown":
                    this.attemptMoveDown();
                    break;
                case "KeyR":
                    this.attemptRotate();
                    break;
                case "KeyP":
                    this.pauseOrResumeGame();
                    break;
            }
            this.syncExistingPiecesWithBoard();
        });
        // functions to pause or resume game with a button //
        [this.$btnPause, this.$btnResume].forEach($btn => $btn.addEventListener("click", () => {
            this.pauseOrResumeGame();
        }));

    }


    // attempt to try to move the piece to the rigth //
    attemptMoveRight() {
        if (this.figureCanMoveRight()) {
            this.globalX++;
        }
    }
    // attempt to try to move the piece to the left//
    attemptMoveLeft() {
        if (this.figureCanMoveLeft()) {
            this.globalX--;
        }
    }
    // attempt to try to move the piece to the down//
    attemptMoveDown() {
        if (this.figureCanMoveDown()) {
            this.globalY++;
        }
    }
    // attempt to try to rotate the piece //
    attemptRotate() {
        this.rotateFigure();
    }

    pauseOrResumeGame() {
        if (this.paused) {
            this.resumeGame();
            this.$btnResume.hidden = true;
            this.$btnPause.hidden = false;
        } else {
            this.pauseGame();
            this.$btnResume.hidden = false;
            this.$btnPause.hidden = true;
        }
    }
    // to pause the game//
    pauseGame() {
        /* this.sounds.background.pause(); */
        this.paused = true;
        this.canPlay = false;
        clearInterval(this.intervalId);
    }
    // to return to the current game after pause//
    resumeGame() {
        this.refreshScore();
        this.paused = false;
        this.canPlay = true;
        this.intervalId = setInterval(this.mainLoop.bind(this), Game.PIECE_SPEED);
    }

    // to return to the current game after pause//
    moveFigurePointsToExistingPieces() {
        this.canPlay = false;
        for (const point of this.currentFigure.getPoints()) {
            point.x += this.globalX;
            point.y += this.globalY;
            this.existingPieces[point.y][point.x] = {
                taken: true,
                color: point.color,
            }
        }
        this.restartGlobalXAndY();
        this.canPlay = true;
    }

    playerLoses() {
        // Check if there's something at Y 1
        for (const point of this.existingPieces[1]) {
            if (point.taken) {
                return true;
            }
        }
        return false;
    }

    getPointsToDelete = () => {
        const points = [];
        let y = 0;
        for (const row of this.existingPieces) {
            const isRowFull = row.every(point => point.taken);
            if (isRowFull) {
                // We only need the Y coordinate
                points.push(y);
            }
            y++;
        }
        return points;
    }
    //// the function cghange the color of a completed line//
    changeDeletedRowColor(yCoordinates) {
        for (let y of yCoordinates) {
            for (const point of this.existingPieces[y]) {
                point.color = Game.DELETED_ROW_COLOR;
            }
        }
    };

    //// the function add the score of the erased row//
    addScore(rows) {
        this.score += Game.PER_SQUARE_SCORE * Game.COLUMNS * rows.length;
        this.refreshScore();
    }

    //// erase the square of the piece of a row completed //
    removeRowsFromExistingPieces(yCoordinates) {
        for (let y of yCoordinates) {
            for (const point of this.existingPieces[y]) {
                point.color = Game.EMPTY_COLOR;
                point.taken = false;
            }
        }
    }

// the function check if it is a line completed and erase it //
    verifyAndDeleteFullRows() {

        const yCoordinates = this.getPointsToDelete();
        if (yCoordinates.length <= 0) return;
        this.addScore(yCoordinates);
        this.changeDeletedRowColor(yCoordinates);
        this.canPlay = false;
        setTimeout(() => {
            this.removeRowsFromExistingPieces(yCoordinates);
            this.syncExistingPiecesWithBoard();
            const invertedCoordinates = Array.from(yCoordinates);
            // Now the coordinates are in descending order
            invertedCoordinates.reverse();

            for (let yCoordinate of invertedCoordinates) {
                for (let y = Game.ROWS - 1; y >= 0; y--) {
                    for (let x = 0; x < this.existingPieces[y].length; x++) {
                        if (y < yCoordinate) {
                            let counter = 0;
                            let auxiliarY = y;
                            while (this.isEmptyPoint(x, auxiliarY + 1) && !this.absolutePointOutOfLimits(x, auxiliarY + 1) && counter < yCoordinates.length) {
                                this.existingPieces[auxiliarY + 1][x] = this.existingPieces[auxiliarY][x];
                                this.existingPieces[auxiliarY][x] = {
                                    color: Game.EMPTY_COLOR,
                                    taken: false,
                                }

                                this.syncExistingPiecesWithBoard();
                                counter++;
                                auxiliarY++;
                            }
                        }
                    }
                }
            }

            this.syncExistingPiecesWithBoard()
            this.canPlay = true;
        }, Game.DELETE_ROW_ANIMATION);
    }

    //Main Game Cycle
    mainLoop() {
        if (!this.canPlay) {
            return;
        }
        // If figure can move down, move down
        if (this.figureCanMoveDown()) {
            this.globalY++;
        } else {
            // If figure cannot, then we start a timeout because
            // player can move figure to keep it going down
            // for example when the figure collapses with another points but there's remaining
            // space at the left or right and the player moves there so the figure can keep going down
            if (this.timeoutFlag) return;
            this.timeoutFlag = true;
            setTimeout(() => {
                this.timeoutFlag = false;
                // If the time expires, we re-check if figure cannot keep going down. If it can
                // (because player moved it) then we return and keep the loop
                if (this.figureCanMoveDown()) {
                    return;
                }
                // At this point, we know that the figure collapsed either with the floor
                // or with another point. So we move all the figure to the existing pieces array

                this.moveFigurePointsToExistingPieces();
                if (this.playerLoses()) {
                    Swal.fire("Juego terminado", "Inténtalo de nuevo");
                    this.canPlay = false;
                    this.resetGame();
                    return;
                }
                this.verifyAndDeleteFullRows();
                this.chooseRandomFigure();
                this.syncExistingPiecesWithBoard();
            }, Game.TIMEOUT_LOCK_PUT_NEXT_PIECE);
        }
        this.syncExistingPiecesWithBoard();
    }

    //Clean the board
    cleanGameBoardAndOverlapExistingPieces() {
        for (let y = 0; y < Game.ROWS; y++) {
            for (let x = 0; x < Game.COLUMNS; x++) {
                this.board[y][x] = {
                    color: Game.EMPTY_COLOR,
                    taken: false,
                };
                // Overlap existing piece if any
                if (this.existingPieces[y][x].taken) {
                    this.board[y][x].color = this.existingPieces[y][x].color;
                }
            }
        }
    }

    overlapCurrentFigureOnGameBoard() {
        if (!this.currentFigure) return;
        for (const point of this.currentFigure.getPoints()) {
            this.board[point.y + this.globalY][point.x + this.globalX].color = point.color;
        }
    }


    syncExistingPiecesWithBoard() {
        this.cleanGameBoardAndOverlapExistingPieces();
        this.overlapCurrentFigureOnGameBoard();
    }

    //Draw the board on the canvas
    draw() {
        let x = 0, y = 0;
        for (const row of this.board) {
            x = 0;
            for (const point of row) {
                this.canvasContext.fillStyle = point.color;
                this.canvasContext.fillRect(x, y, Game.SQUARE_LENGTH, Game.SQUARE_LENGTH);
                this.canvasContext.restore();
                this.canvasContext.strokeStyle = Game.BORDER_COLOR;
                this.canvasContext.strokeRect(x, y, Game.SQUARE_LENGTH, Game.SQUARE_LENGTH);
                x += Game.SQUARE_LENGTH;
            }
            y += Game.SQUARE_LENGTH;
        }
        setTimeout(() => {
            requestAnimationFrame(this.draw.bind(this));
        }, 20
        );
    }

    refreshScore() {
        this.$score.textContent = `Score: ${this.score}`;
    }

    //Start the elements of the Dom
    initDomElements() {
        this.$canvas = document.querySelector("#" + this.canvasId);
        this.$score = document.querySelector("#puntaje");
        this.$btnPause = document.querySelector("#btnPausar");
        this.$btnResume = document.querySelector("#btnIniciar");
        this.$canvas.setAttribute("width", Game.CANVAS_WIDTH + "px");
        this.$canvas.setAttribute("height", Game.CANVAS_HEIGHT + "px");
        this.canvasContext = this.$canvas.getContext("2d");
    }

    // a figure is choosed randomly// 
    chooseRandomFigure() {
        this.currentFigure = this.getRandomFigure();
    }

    //Restart X and Y to place a new piece, X puts it in the middle of the board and Y zeroes
    restartGlobalXAndY() {
        this.globalX = Math.floor(Game.COLUMNS / 2) - 1;
        this.globalY = 0;
    }

    // The function to select one of the tetrominoes randomly//
    getRandomFigure() {
        /* Regresamos una nueva instancia en cada ocasión, pues si definiéramos las figuras en constantes o variables, se tomaría la misma
        referencia en algunas ocasiones */

        switch (Utils.getRandomNumberInRange(1, 7)) {

            case 1:
                /* The square "O"*/
                return new Tetromino([
                    [new Point(0, 0),
                    new Point(1, 0), 
                    new Point(0, 1), 
                    new Point(1, 1)]
                ]);

            case 2:
                /* The Line "|"*/
                return new Tetromino([
                    [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(3, 0)],
                    [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(0, 3)],
                ]);

            case 3:
                /* The "L" */
                return new Tetromino([
                    [new Point(0, 1), new Point(1, 1), new Point(2, 1), new Point(2, 0)],
                    [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(1, 2)],
                    [new Point(0, 0), new Point(0, 1), new Point(1, 0), new Point(2, 0)],
                    [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(1, 2)],
                ]);

            case 4:
                /*  The "J" */
                return new Tetromino([
                    [new Point(0, 0), new Point(0, 1), new Point(1, 1), new Point(2, 1)],
                    [new Point(0, 0), new Point(1, 0), new Point(0, 1), new Point(0, 2)],
                    [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(2, 1)],
                    [new Point(0, 2), new Point(1, 2), new Point(1, 1), new Point(1, 0)],
                ]);

            case 5:
                /* The "Z" */
                return new Tetromino([
                    [new Point(0, 0), new Point(1, 0), new Point(1, 1), new Point(2, 1)],
                    [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(0, 2)],
                ]);

            case 6:
                /* The "S" */
                return new Tetromino([
                    [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(2, 0)],
                    [new Point(0, 0), new Point(0, 1), new Point(1, 1), new Point(1, 2)],
                ]);

            case 7:
            default:
                /*  The "T" */
                return new Tetromino([
                    [new Point(0, 1), new Point(1, 1), new Point(1, 0), new Point(2, 1)],
                    [new Point(0, 0), new Point(0, 1), new Point(0, 2), new Point(1, 1)],
                    [new Point(0, 0), new Point(1, 0), new Point(2, 0), new Point(1, 1)],
                    [new Point(0, 1), new Point(1, 0), new Point(1, 1), new Point(1, 2)],
                ]);
        }
    }

    initBoardAndExistingPieces() {
        this.board = [];
        this.existingPieces = [];
        for (let y = 0; y < Game.ROWS; y++) {
            this.board.push([]);
            this.existingPieces.push([]);
            for (let x = 0; x < Game.COLUMNS; x++) {
                this.board[y].push({
                    color: Game.EMPTY_COLOR,
                    taken: false,
                });
                this.existingPieces[y].push({
                    taken: false,
                    color: Game.EMPTY_COLOR,
                });
            }
        }
    }

    /*
    @param point An object that has x and y properties; the coordinates shouldn't be global, but relative to the point
    @returns {boolean}
     */
    relativePointOutOfLimits(point) {
        const absoluteX = point.x + this.globalX;
        const absoluteY = point.y + this.globalY;
        return this.absolutePointOutOfLimits(absoluteX, absoluteY);
    }

    /*
    @param absoluteX
    @param absoluteY
    @returns {boolean}
     */
    absolutePointOutOfLimits(absoluteX, absoluteY) {
        return absoluteX < 0 || absoluteX > Game.COLUMNS - 1 || absoluteY < 0 || absoluteY > Game.ROWS - 1;
    }

    // It returns true even if the point is not valid (for example if it is out of limit, because it is not the function's responsibility)
    isEmptyPoint(x, y) {
        if (!this.existingPieces[y]) return true;
        if (!this.existingPieces[y][x]) return true;
        if (this.existingPieces[y][x].taken) {
            return false;
        } else {
            return true;
        }
    }

    /*
    Check if a point (in the game board) is valid to put another point there.
    @param point the point to check, with relative coordinates
    @param points an array of points that conforms a figure
     */

    isValidPoint(point, points) {
        const emptyPoint = this.isEmptyPoint(this.globalX + point.x, this.globalY + point.y);
        const hasSameCoordinateOfFigurePoint = points.findIndex(p => {
            return p.x === point.x && p.y === point.y;
        }) !== -1;
        const outOfLimits = this.relativePointOutOfLimits(point);
        if ((emptyPoint || hasSameCoordinateOfFigurePoint) && !outOfLimits) {
            return true;
        } else {
            return false;
        }
    }

    /// after confirm with the figure movement attemp is possible to the right the function moves the figure 1 square//
    figureCanMoveRight() {
        if (!this.currentFigure) return false;
        for (const point of this.currentFigure.getPoints()) {
            const newPoint = new Point(point.x + 1, point.y);
            if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
                return false;
            }
        }
        return true;
    }
    /// after confirm with the figure movement attemp is possible to left the function moves the figure 1 square//
    figureCanMoveLeft() {
        if (!this.currentFigure) return false;
        for (const point of this.currentFigure.getPoints()) {
            const newPoint = new Point(point.x - 1, point.y);
            if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
                return false;
            }
        }
        return true;
    }
    /// after confirm with the figure movement attemp is possible to down the function moves the figure 1 square//
    figureCanMoveDown() {
        if (!this.currentFigure) return false;
        for (const point of this.currentFigure.getPoints()) {
            const newPoint = new Point(point.x, point.y + 1);
            if (!this.isValidPoint(newPoint, this.currentFigure.getPoints())) {
                return false;
            }
        }
        return true;
    }
    /// after confirm the attempt of rotation rotate the piece//
    figureCanRotate() {
        const newPointsAfterRotate = this.currentFigure.getNextRotation();
        for (const rotatedPoint of newPointsAfterRotate) {
            if (!this.isValidPoint(rotatedPoint, this.currentFigure.getPoints())) {
                return false;
            }
        }
        return true;
    }

    rotateFigure() {
        if (!this.figureCanRotate()) {
            return;
        }
        this.currentFigure.points = this.currentFigure.getNextRotation();
        this.currentFigure.incrementRotationIndex();
    }

    async askUserConfirmResetGame() {
        this.pauseGame();
        const result = await Swal.fire({
            title: 'Reiniciar',
            text: "¿Quieres reiniciar el juego?",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#fdbf9c',
            cancelButtonColor: '#4A42F3',
            cancelButtonText: 'No',
            confirmButtonText: 'Sí'
        });
        if (result.value) {
            this.resetGame();
        } else {
            this.resumeGame();
        }
    }

}

class Utils {
    static getRandomNumberInRange = (min, max) => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    static getRandomColor() {
        return Game.COLORS[Utils.getRandomNumberInRange(0, Game.COLORS.length - 1)];
    }

}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Tetromino {
    constructor(rotations) {
        this.rotations = rotations;
        this.rotationIndex = 0;
        this.points = this.rotations[this.rotationIndex];
        const randomColor = Utils.getRandomColor();
        this.rotations.forEach(points => {
            points.forEach(point => {
                point.color = randomColor;
            });
        });
        this.incrementRotationIndex();
    }

    getPoints() {
        return this.points;
    }

    incrementRotationIndex() {
        if (this.rotations.length <= 0) {
            this.rotationIndex = 0;
        } else {
            if (this.rotationIndex + 1 >= this.rotations.length) {
                this.rotationIndex = 0;
            } else {
                this.rotationIndex++;
            }
        }
    }

    getNextRotation() {
        return this.rotations[this.rotationIndex];
    }

}

const game = new Game("canvas");
document.querySelector("#reset").addEventListener("click", () => {
    game.askUserConfirmResetGame();
});


