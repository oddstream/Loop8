// @ts-check
// TODO check for memory leaks
// TODO find out why SVG onend event doesn't work
// TODO graphics gap at some junctions

"use strict";

const DEBUGGING = false;

const Q = 100;
const strQ = Q.toString();
const Q50 = Math.floor(Q/2);
const strQ50 = Q50.toString();
const Q5 = Math.floor(Q/20);
const strQ5 = Q5.toString(); 

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NORTH     = 0b00000001;
const NORTHEAST = 0b00000010;
const EAST      = 0b00000100;
const SOUTHEAST = 0b00001000;
const SOUTH     = 0b00010000;
const SOUTHWEST = 0b00100000;
const WEST      = 0b01000000;
const NORTHWEST = 0b10000000;

const linkData = [
    { bit: NORTH,       opp: SOUTH,     link:'n',    x: strQ50, y: "0"     },
    { bit: NORTHEAST,   opp: SOUTHWEST, link:'ne',   x: strQ,   y: "0"     },
    { bit: EAST,        opp: WEST,      link:'e',    x: strQ,   y: strQ50  },
    { bit: SOUTHEAST,   opp: NORTHWEST, link:'se',   x: strQ,   y: strQ    },
    { bit: SOUTH,       opp: NORTH,     link:'s',    x: strQ50, y: strQ    },
    { bit: SOUTHWEST,   opp: NORTHEAST, link:'sw',   x: "0",    y: strQ    },
    { bit: WEST,        opp: EAST,      link:'w',    x: "0",    y: strQ50  },
    { bit: NORTHWEST,   opp: SOUTHEAST, link:'nw',   x: "0",    y: "0"     }
];

const PLACE_COIN_CHANCE = 0.4;
const JUMBLE_COIN_CHANCE = 0.5;

// https://en.wikipedia.org/wiki/Web_colors
const BACKGROUND_COLOR = 'lightblue';
const INPROGRESS_COLOR = 'darkblue';
const COMPLETED_COLOR = 'black';
const HIGHLIGHT_COLOR = 'darkorange';

let gameState = null;

function addStyle()
{
    const css = `svg:hover { stroke: ${HIGHLIGHT_COLOR}; }`;
    const style = document.createElement('style');  // magically creates an object with HTMLStyleElement interface
    style.appendChild(document.createTextNode(css));
    document.getElementsByTagName('head')[0].appendChild(style);
}

function removeStyle()
{
    let ele = null;
    while ( ele = document.querySelector("head>style") )
        ele.parentNode.removeChild(ele);
}

class GameState
{
    constructor()
    {
        this._gridsSolved = this._getLocalStorageNumber("gridsSolved", 0);
        this._jumbleCoinChance = this._gridsSolved / 200;
        this._jumbleCoinChance = Math.min(this._jumbleCoinChance, 0.5);
        this._jumbleCoinChance = Math.max(this._jumbleCoinChance, 0.05);
    }

    gridSolved()
    {
        this._gridsSolved += 1;
        window.localStorage.setItem("gridsSolved", this._gridsSolved.toString());
    }

    _getLocalStorageNumber(key, defaultValue)
    {
        const val = window.localStorage.getItem(key);
        if ( null === val )
            return defaultValue;
        else
            return parseInt(val);
    }
    
    get jumbleCoinChance()
    {
        return this._jumbleCoinChance;
    }
}

class Tile
{
    constructor()
    {
        this.n = this.ne = this.e = this.se = this.s = this.sw = this.w = this.nw = null;
        this.coins = this.originalCoins = 0;
        this.div = null;
    }

    bitCount()
    {
        return this.coins.toString(2).split('1').length-1;
    }

    getSinglePoint()
    {
        const b2p = linkData.find( ele => Boolean(this.coins & ele.bit) );
        if ( b2p )
            return { x:b2p.x, y:b2p.y };
        throw new RangeError(`Bit ${this.coins} not found`);
    }

    spinSVG(clockwise=true, degrees=45)
    {   // this == Tile
        const that = this;
        let angle = 5;

        const g = this.div.querySelector("g");
        const tilt = function()
        {   // this == null
            g.setAttributeNS(null, 'transform', `rotate(${clockwise?'':'-'}${angle} ${Q50},${Q50})`);
            angle += 5;
            if ( angle < degrees )
                window.requestAnimationFrame(tilt);
            else
                window.requestAnimationFrame(that.setGraphic.bind(that));
        };
        window.requestAnimationFrame(tilt);
    }

    shiftBits(num = 1)
    {
        while ( num-- )
        {
            if ( this.coins & 0b10000000 )
                this.coins = ((this.coins << 1) & 0b11111111) | 0b00000001;
            else
                this.coins = (this.coins << 1) & 0b11111111;

        }
    }

    unshiftBits(num = 1)
    {
        while ( num-- )
        {
            if ( this.coins & 0b00000001 )
                this.coins = (this.coins >> 1) | 0b10000000;
            else
                this.coins = this.coins >> 1;
        }
    }

    rotate()
    {
        this.spinSVG(true, 45);
        this.shiftBits();
    }

    unRotate()
    {
        this.spinSVG(false, 45);
        this.unshiftBits();
    }

    unJumble()
    {
        this.coins = this.originalCoins;
        this.setGraphic();
    }

    isTileComplete()
    {
        for ( let chkLink of linkData.filter(chk => this.coins & chk.bit) )
        {
            if ( (this[chkLink.link] === null) )
                return false;
            if ( !(this[chkLink.link].coins & chkLink.opp) )
                return false;
        }
        return true;
    }

    getRoot()
    {
        let t = this;
        while ( t.nw ) t = t.nw;
        while ( t.w ) t = t.w;
        while ( t.n ) t = t.n;
        return t;
    }

    *createIterator()
    {
        for ( let y=this.getRoot(); y; y=y.s )
        {
            for ( let x=y; x; x=x.e )
            {
                yield x;
            }
        }
    }

    isGridComplete()
    {
        const it = this.createIterator();
        for ( const t of it )
            if ( !t.isTileComplete() )
                return false;
        return true;
    }

    placeCoin()
    {
        if ( this.e )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | EAST;
                this.e.coins = this.e.coins | WEST;
            }
        }
        if ( this.se )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHEAST;
                this.se.coins = this.se.coins | NORTHWEST;
            }
        }
        if ( this.s )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTH;
                this.s.coins = this.s.coins | NORTH;
            }
        }
        if ( this.sw )
        {
            if ( Math.random() < PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHWEST;
                this.sw.coins = this.sw.coins | NORTHEAST;
            }
        }
    }

    jumbleCoin()
    {
        function getRandomInt(min, max)
        {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        if ( DEBUGGING )
        {
            if ( Math.random() < 0.05 )
                this.unshiftBits();
        }
        else
        {
            if ( Math.random() < gameState.jumbleCoinChance )
            {
                if ( Math.random() > 0.5 )
                    this.shiftBits(getRandomInt(0,4));
                else
                    this.unshiftBits(getRandomInt(0,4));
            }
        }
    }

    // Tile implements the handleEvent interface
    handleEvent(event)
    {
        if ( event.type != "click" )
        {
            console.log(event);
            return;
        }

        if ( this.isGridComplete() )
            return;

        if ( event.altKey )
            this.unJumble();
        else if ( event.shiftKey || event.ctrlKey )
            this.unRotate();
        else
            this.rotate();

        if ( this.isGridComplete() )
        {
            gameState.gridSolved();

            removeStyle();
            // TODO async/Promise?
            const it = this.createIterator();
            window.setTimeout( () => {
                for ( const t of it )
                    t.strokeItBlack(COMPLETED_COLOR);
            }, 500);
        }
    }

    strokeItBlack(strokeColor=COMPLETED_COLOR)
    {
        let ele = this.div.querySelector("circle");
        if ( ele )
            ele.setAttributeNS(null, 'fill', strokeColor);
        ele = this.div.querySelector("svg");
        if ( ele )
            ele.setAttributeNS(null, 'stroke', strokeColor);
    }

    setGraphic()
    {
        if ( 0 === this.coins )
            return;

        const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
        svg.setAttributeNS(null, 'width', strQ);
        svg.setAttributeNS(null, 'height', strQ);
        svg.setAttributeNS(null, 'stroke', INPROGRESS_COLOR);
        svg.setAttributeNS(null, 'stroke-width', DEBUGGING ? this.bitCount().toString() : '1');
        svg.setAttributeNS(null, 'fill', 'none');
        this.div.addEventListener("click", this);

        const g = document.createElementNS(SVG_NAMESPACE, 'g');
        svg.appendChild(g);

        const numBits = this.bitCount();
        if ( 1 == numBits )
        {
            const eleLine = document.createElementNS(SVG_NAMESPACE, 'line');
                const pt = this.getSinglePoint();
                eleLine.setAttributeNS(null, 'x1', pt.x);
                eleLine.setAttributeNS(null, 'y1', pt.y);
                eleLine.setAttributeNS(null, 'x2', strQ50);
                eleLine.setAttributeNS(null, 'y2', strQ50);
            g.appendChild(eleLine);

            const eleCircle = document.createElementNS(SVG_NAMESPACE, 'circle');
                eleCircle.setAttributeNS(null, 'r', strQ5);
                eleCircle.setAttributeNS(null, 'cx', strQ50);
                eleCircle.setAttributeNS(null, 'cy', strQ50);
                eleCircle.setAttributeNS(null, 'fill', HIGHLIGHT_COLOR);
            g.appendChild(eleCircle);
        }
        else
        {
/*
    The initial M directive moves the pen to the first point (100,100).
    Two co-ordinates follow the ‘Q’; the single control point (50,50) and the final point we’re drawing to (0,0).
    It draws perfectly good straight lines, too, so no need for separate 'line' element.
*/
            let path = "";
            let ldFirst = undefined;
            for ( let ld of linkData )
            {
                if ( this.coins & ld.bit )
                {
                    if ( path.length === 0 )
                    {
                        ldFirst = ld;
                        path = `M${ld.x},${ld.y}`;
                    }
                    else
                    {
                        path = path.concat(` Q${Q50},${Q50} ${ld.x},${ld.y}`);
                    }
                }
            }
            if ( numBits > 4 )  // close the path for better aesthetics
                path = path.concat(` Q${Q50},${Q50} ${ldFirst.x},${ldFirst.y}`);
            
            const ele = document.createElementNS(SVG_NAMESPACE, 'path');
            ele.setAttributeNS(null, 'd', path);
            g.appendChild(ele);
        }

        // this.div > svg > g > path|circle|line
        while ( this.div.lastChild )
            this.div.removeChild(this.div.lastChild);
        this.div.appendChild(svg);
    }
}

class GridOfTiles
{
    constructor(numX=7, numY=5)
    {
        this.numX = numX;
        this.numY = numY;
        this.grid = this.createFirstRow(numX, null);
        let row = numY;

        for ( let nextRow=this.grid; row>1; row--, nextRow=nextRow.s )
        {
            let tPrev = null;
            for ( let t = nextRow; t; t = t.e)
            {
                t.s = new Tile();
                t.s.n = t;

                t.s.w = tPrev;
                if ( tPrev )
                {
                    tPrev.e = t.s;
                }

                tPrev = t.s;
            }
        }
    
        const it = this.createIterator();
        for ( const t of it )
        {
            if ( t.e && t.e.n ) { t.ne = t.e.n; t.e.n.sw = t; }         // NORTHEAST
            if ( t.e && t.e.s ) { t.se = t.e.s; t.e.s.nw = t; }         // SOUTHEAST
            if ( t.w && t.w.s ) { t.sw = t.w.s; t.w.s.ne = t; }         // SOUTHWEST
            if ( t.w && t.w.n ) { t.nw = t.w.n; t.w.n.se = t; }         // NORTHWEST
        }
    }

    createFirstRow(n, leftTile)
    {
        let t = new Tile();
        t.w = leftTile;
        if ( n > 1 )
        {
            t.e = this.createFirstRow(n-1, t);
        }
        return t;
    }

    placeCoins()
    {
        const it = this.createIterator();
        for ( const t of it )
            t.placeCoin();

        return this;
    }

    jumbleCoins()
    {
        while ( this.grid.isGridComplete() )
        {
            const it = this.createIterator();
            for ( const t of it )
            {
                t.originalCoins = t.coins;
                t.jumbleCoin();
            }
        }
        return this;
    }

    createHTML()
    {
        addStyle();

        // create a grid container; all direct children will become grid items
        const eleWrapper = document.createElement("div");
        // set attributes; "grid-gap" becomes camelCase "gridGrap"
        eleWrapper.style.display = "grid";
        // @ts-ignore: Property 'gridGap' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridGap = "0px 0px";   // auto-sets .gridRowGap="0px" and .gridColumnGap="0px"
        // @ts-ignore: Property 'gridTemplateRows' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateRows = `${Q}px `.repeat(this.numY);        // can't use SVG repeat(5,100px)
        // @ts-ignore: Property 'gridTemplateColumns' does not exist on type 'CSSStyleDeclaration'
        eleWrapper.style.gridTemplateColumns = `${Q}px `.repeat(this.numX);     // can't use SVG repeat(7,100px)
        eleWrapper.style.backgroundColor = BACKGROUND_COLOR;
        eleWrapper.style.border = `1px solid ${INPROGRESS_COLOR}`;
        eleWrapper.style.width = `${Q * this.numX}px`;
        eleWrapper.style.height = `${Q * this.numY}px`;

        const it = this.createIterator();
        for ( const t of it )
        {
            // n.b. the iterator must generate the rows across for the HTML grid to work
            t.div = document.createElement("div");
            eleWrapper.appendChild(t.div);
        }

        document.body.appendChild(eleWrapper);

        return this;
    }

    setGraphics()
    {
        const it = this.createIterator();
        for ( const t of it )
            t.setGraphic();

        return this;
    }

    *createIterator()
    {
        // loop y outside x to generate grid elements in correct order
        for ( let y=this.grid; y; y=y.s )
        {
            for ( let x=y; x; x=x.e )
            {
                yield x;
            }
        }
    }
}

function main()
{
    gameState = new GameState();

    const got = new GridOfTiles(
        Math.max(Math.floor(window.innerWidth / Q), 3),
        Math.max(Math.floor(window.innerHeight / Q), 3)
    );
    got.createHTML().placeCoins().jumbleCoins().setGraphics();
}

main();
