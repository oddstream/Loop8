# Loop8

Eight-way version of the Android Infinity Loop game in Vanilla ES6 Javascript

Implemented using a lattice of linked nodes, which are called tiles. Each tile is an object which contains links to it's eight neighbours.
So much more fun than using a two dimensional array.

Each tile is rendered inside its own HTML DIV element. The DIV element is a container for an SVG element, which contains anSVG group (G) and then SVG drawing element(s).

The loops are implemented not as loops, but by the notion of placing 'coins' at each edge of a tile that contains a link to it's neighbour. Each tile contains zero to
eight coins. The coins are referred to by compass points. The coins are reciprocal, so, for example, if a tile has a 'north' coin, then it's neighbour to the north
will have a 'south' coin.

The puzzle is complete when, for each tile, every coin has a matching recriocal coin in it's neighbour.

The coins for each tile are held as bits in a number. Tile rotation clockwise is done by rotating the bits in the number to the right.



