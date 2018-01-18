/*jshint esversion:6, unused:true, undef:true */

"use strict";

const DEBUGGING = 0;

const Q = 100;
const Q50 = Math.floor(Q/2);
const Q10 = Math.floor(Q/10);
const Q5 = Math.floor(Q/20);

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const NORTH     = 0b00000001;
const NORTHEAST = 0b00000010;
const EAST      = 0b00000100;
const SOUTHEAST = 0b00001000;
const SOUTH     = 0b00010000;
const SOUTHWEST = 0b00100000;
const WEST      = 0b01000000;
const NORTHWEST = 0b10000000;

const bit2point = [
        { bit: NORTH,       x: Q50, y:0    },
        { bit: NORTHEAST,   x: Q,   y:0    },
        { bit: EAST,        x: Q,   y:Q50  },
        { bit: SOUTHEAST,   x: Q,   y:Q    },
        { bit: SOUTH,       x: Q50, y:Q    },
        { bit: SOUTHWEST,   x: 0,   y:Q    },
        { bit: WEST,        x: 0,   y:Q50  },
        { bit: NORTHWEST,   x: 0,   y:0    }
    ];

const PLACE_COIN_CHANCE = 0.5;
const JUMBLE_COIN_CHANCE = 0.8;

// https://en.wikipedia.org/wiki/Web_colors
const BACKGROUND_COLOR = 'powderblue';
const INPROGRESS_COLOR = 'navy';
const COMPLETED_COLOR = 'black';
const HIGHLIGHT_COLOR = 'darkorange';

function main()
{
    const got = new GridOfTiles(
        Math.max(Math.floor(window.innerWidth / Q), 3),
        Math.max(Math.floor(window.innerHeight / Q), 3)
    );
    got.createHTML().placeCoins().jumbleCoins().setGraphics();
}

function addStyle()
{
    const css = `svg:hover { stroke: ${HIGHLIGHT_COLOR}; }`;
    const style = document.createElement('style');
    if (style.styleSheet)
    {
        style.styleSheet.cssText = css;
    }
    else
    {
        style.appendChild(document.createTextNode(css));
    }
    document.getElementsByTagName('head')[0].appendChild(style);
}

function removeStyle()
{
    const ele = document.querySelector("head>style");
    if ( ele )
        ele.parentNode.removeChild(ele);
}

class Tile
{
    constructor()
    {
        this.n = null;
        this.ne = null;
        this.e = null;
        this.se = null;
        this.s = null;
        this.sw = null;
        this.w = null;
        this.nw = null;

        this.coins = this.originalCoins = 0;

        this.div = null;
    }

    bitCount()
    {
        return this.coins.toString(2).split('1').length-1;
    }

    getSinglePoint()
    {
        const b2p = bit2point.find( ele => this.coins & ele.bit );
        if ( b2p )
            return { x:b2p.x, y:b2p.y };
        throw new Error(`Bit ${this.coins} not found`);
    }

    spinSVG(degrees=45)
    {
        const that = this;
        let angle = 5;

        const g = this.div.querySelector("g");
        const tilt = function()
        {
            g.setAttributeNS(null, 'transform', `rotate(${angle} ${Q50},${Q50})`);
            angle += 5;
            if ( angle < degrees )
                window.requestAnimationFrame(tilt);
            else
                window.requestAnimationFrame(that.setGraphic.bind(that));
        };
        window.requestAnimationFrame(tilt);
    }

    unspinSVG(degrees=45)
    {
        const that = this;
        let angle = 5;

        const g = this.div.querySelector("g");
        const tilt = function()
        {
            g.setAttributeNS(null, 'transform', `rotate(-${angle} ${Q50},${Q50})`);
            angle += 5;
            if ( angle < degrees )
                window.requestAnimationFrame(tilt);
            else
                window.requestAnimationFrame(that.setGraphic.bind(that));
        };
        window.requestAnimationFrame(tilt);
    }

    shiftBits()
    {
        if ( this.coins & 0b10000000 )
            this.coins = ((this.coins << 1) & 0b11111111) | 0b00000001;
        else
            this.coins = (this.coins << 1) & 0b11111111;
    }

    unshiftBits()
    {
        if ( this.coins & 0b00000001 )
            this.coins = (this.coins >> 1) | 0b10000000;
        else
            this.coins = this.coins >> 1;
    }

    rotate()
    {
        if ( this.coins === 0  )
            return;
        this.spinSVG();
        this.shiftBits();
    }

    unrotate()
    {
        if ( this.coins === 0  )
            return;
        this.unspinSVG();
        this.unshiftBits();
    }

    isTileComplete()
    {
        if (this.coins & NORTH) {
            if ((this.n === null) || !(this.n.coins & SOUTH)) {
                return false;
            }
        }
        if (this.coins & NORTHEAST) {
            if ((this.ne === null) || !(this.ne.coins & SOUTHWEST)) {
                return false;
            }
        }
        if (this.coins & EAST) {
            if ((this.e === null) || !(this.e.coins & WEST)) {
                return false;
            }
        }
        if (this.coins & SOUTHEAST) {
            if ((this.se === null) || !(this.se.coins & NORTHWEST)) {
                return false;
            }
        }
        if (this.coins & SOUTH) {
            if ((this.s === null) || !(this.s.coins & NORTH)) {
                return false;
            }
        }
        if (this.coins & SOUTHWEST) {
            if ((this.sw === null) || !(this.sw.coins & NORTHEAST)) {
                return false;
            }
        }
        if (this.coins & WEST) {
            if ((this.w === null) || !(this.w.coins & EAST)) {
                return false;
            }
        }
        if (this.coins & NORTHWEST) {
            if ((this.nw === null) || !(this.nw.coins & SOUTHEAST)) {
                return false;
            }
        }
        return true;
    }

    getRoot()
    {
        let t = this;
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
            if ( Math.random() > PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | EAST;
                this.e.coins = this.e.coins | WEST;
            }
        }
        if ( this.se )
        {
            if ( Math.random() > PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHEAST;
                this.se.coins = this.se.coins | NORTHWEST;
            }
        }
        if ( this.s )
        {
            if ( Math.random() > PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTH;
                this.s.coins = this.s.coins | NORTH;
            }
        }
        if ( this.sw )
        {
            if ( Math.random() > PLACE_COIN_CHANCE )
            {
                this.coins = this.coins | SOUTHWEST;
                this.sw.coins = this.sw.coins | NORTHEAST;
            }
        }
    }

    jumbleCoin()
    {
        if ( DEBUGGING )
        {
            if ( Math.random() > 0.95 )
                this.unshiftBits();
        }
        else
        {
            if ( Math.random() > JUMBLE_COIN_CHANCE )
            {
                this.unshiftBits();
            }
            else if ( Math.random() > JUMBLE_COIN_CHANCE )
            {
                this.shiftBits();
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
        {
            this.coins = this.originalCoins;
            this.setGraphic();
        }
        else if ( event.shiftKey || event.ctrlKey )
            this.unrotate();
        else
            this.rotate();

        if ( this.isGridComplete() )
        {
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
        svg.setAttributeNS(null, 'width', Q);
        svg.setAttributeNS(null, 'height', Q);
        svg.setAttributeNS(null, 'stroke', INPROGRESS_COLOR);
        svg.setAttributeNS(null, 'stroke-width', 1);
        svg.setAttributeNS(null, 'fill', 'none');
        this.div.addEventListener("click", this);

        const g = document.createElementNS(SVG_NAMESPACE, 'g');
        svg.appendChild(g);

        const numBits = this.bitCount();
        if ( 1 == numBits )
        {
            let ele = document.createElementNS(SVG_NAMESPACE, 'line');
                const pt = this.getSinglePoint();
                ele.setAttributeNS(null, 'x1', pt.x);
                ele.setAttributeNS(null, 'y1', pt.y);
                ele.setAttributeNS(null, 'x2', Q50);
                ele.setAttributeNS(null, 'y2', Q50);
            g.appendChild(ele);

            ele = document.createElementNS(SVG_NAMESPACE, 'circle');
                ele.setAttributeNS(null, 'r', Q5);
                ele.setAttributeNS(null, 'cx', Q50);
                ele.setAttributeNS(null, 'cy', Q50);
                ele.setAttributeNS(null, 'fill', HIGHLIGHT_COLOR);
            g.appendChild(ele);
        }
        else
        {
/*
    The initial M directive moves the pen to the first point (100,100).
    Two co-ordinates follow the ‘Q’; the single control point (50,50) and the final point we’re drawing to (0,0).
    It draws perfectly good straight lines, too, so no need for separate 'line' element.
*/
            let path = "";
            for ( let b2p of bit2point )
            {
                if ( this.coins & b2p.bit )
                {
                    if ( path.length === 0 )
                        path = `M${b2p.x},${b2p.y}`;
                    else
                        path = path.concat(` Q${Q50},${Q50} ${b2p.x},${b2p.y}`);
                }
            }

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

function GridOfTiles(numX=7, numY=5)
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
{
    GridOfTiles.prototype.createFirstRow = function(n, leftTile)
    {
        let t = new Tile();
        t.w = leftTile;
        if ( n > 1 )
        {
            t.e = this.createFirstRow(n-1, t);
        }
        return t;
    };

    GridOfTiles.prototype.placeCoins = function()
    {
        const it = this.createIterator();
        for ( const t of it )
            t.placeCoin();

        return this;
    };

    GridOfTiles.prototype.jumbleCoins = function()
    {
        const it = this.createIterator();
        for ( const t of it )
        {
            t.originalCoins = t.coins;
            t.jumbleCoin();
        }

        return this;
    };

    GridOfTiles.prototype.createHTML = function()
    {
        addStyle();

        // create a grid container; all direct children will become grid items
        const eleWrapper = document.createElement("div");
        // set attributes; "grid-gap" becomes camelCase "gridGrap"
        eleWrapper.style.display = "grid";
        eleWrapper.style.gridGap = "0px 0px";   // auto-sets .gridRowGap and .gridColumnGap
        eleWrapper.style.gridTemplateRows = `${Q}px `.repeat(this.numY);        // can't use SVG repeat(5,100px)
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
    };

    GridOfTiles.prototype.setGraphics = function()
    {
        const it = this.createIterator();
        for ( const t of it )
            t.setGraphic();

        return this;
    };

    GridOfTiles.prototype.createIterator = function*()
    {
        // loop y outside x to generate grid elements in correct order
        for ( let y=this.grid; y; y=y.s )
        {
            for ( let x=y; x; x=x.e )
            {
                yield x;
            }
        }
    };
}

main();
