# Loop8

Eight-way version of the Android Infinity Loop game in Vanilla ES6 Javascript

Original concept by Infinity Games (Prof Dr Augusti Abreu from Portual).

## Gameplay

The puzzle fills the available browser window. Click on a piece to rotate it 45&deg; clockwise (or hold down Alt to rotate it anticlockwise). When the puzzle is completed,
the loops change colour and won't rotate any more. Click again to create a new puzzle. Resize the browser window to make the puzzle easier or harder.
The puzzles get harder to solve the more times you complete a puzzle.
The idea is to make the game as simple and frictionless as possible; I've taken everything out that you don't really need.
It's endless, so there's no concept of scores. 
Just relax and click.

## Implementation

It's implemented using a lattice of square-shaped linked nodes, which are called tiles. Each tile is an object which contains links to it's eight neighbours.
So much more fun than using a two dimensional array.

Each tile is rendered inside its own HTML DIV element. The DIV element is a container for an SVG element, which contains an SVG group (G) and then SVG drawing element(s).
When the DIV receives a mouse click, the SVG group in the DIV is rotated 45&deg; in 5&deg; increments, timed against window.requestAnimationFrame(). Then the SVG is replaced with
a new copy.

The loops are implemented not as loops, but by the notion of placing 'coins' at each edge of a tile that contains a link to it's neighbour. Each tile contains zero to
eight coins. The coins are referred to by compass points. The coins are reciprocal, so, for example, if a tile has a 'north' coin, then it's neighbour to the 'north'
will have a 'south' coin.

The puzzle is complete when, for each tile, every coin has a matching reciprocal coin in it's neighbour.

The coins for each tile are held as bits in a number. Tile rotation clockwise is done by rotating the bits in the number to the right.

The game is implemented in three files, a minimal wrapper .html file and a a couple of script .js files. All the exciting HTML is created on the fly by the script.

The .html wrapper can take "command line" style arguments to set the size of the puzzle, or put the game into debug or design mode, for example

    /somepath/Loop6.html?x=7&y=5&debug=1
    
Tested in the uptodate versions of Chrome, Brave, Firefox and Edge.
